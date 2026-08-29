import { sql } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { directoryConfig, evallyAdminIds, isDirectorySyncEnabled } from "./config";
import { EvallyHttpError, fetchDirectorySnapshot } from "./client";

const ADVISORY_LOCK_KEY = 81422917;
const SHRINK_RATIO = 0.5;

// A snapshot decides who exists. Accepting a stale one — a cached response, a
// replayed body — silently rolls the roster back to whenever it was generated.
// Generous enough to absorb clock skew and a slow upstream, tight enough that
// yesterday's roster is never mistaken for today's.
const MAX_SNAPSHOT_AGE_MS = 60 * 60 * 1000;
const MAX_SNAPSHOT_SKEW_MS = 5 * 60 * 1000;

export type DirectorySyncResult =
  | { ok: true; upserted: number; deactivated: number }
  | { ok: false; reason: string };

export async function runDirectorySync(options: { overrideShrinkGuard?: boolean } = {}): Promise<DirectorySyncResult> {
  if (!isDirectorySyncEnabled()) {
    return { ok: false, reason: "disabled" };
  }

  const locked = await db.execute<{ locked: boolean }>(
    sql`select pg_try_advisory_lock(${ADVISORY_LOCK_KEY}) as locked`,
  );
  const gotLock = Boolean((locked.rows[0] as { locked?: boolean } | undefined)?.locked);
  if (!gotLock) {
    return { ok: false, reason: "locked" };
  }

  try {
    const snapshot = await fetchDirectorySnapshot();
    const generatedAt = Date.parse(String(snapshot.generated_at ?? ""));
    if (!Number.isFinite(generatedAt)) {
      return { ok: false, reason: "invalid_generated_at" };
    }

    const age = Date.now() - generatedAt;
    if (age > MAX_SNAPSHOT_AGE_MS || age < -MAX_SNAPSHOT_SKEW_MS) {
      console.error("[SSO] directory snapshot rejected as stale", {
        generated_at: snapshot.generated_at,
        age_seconds: Math.round(age / 1000),
      });
      return { ok: false, reason: "stale_snapshot" };
    }

    const students = Array.isArray(snapshot.students) ? snapshot.students : [];
    const seen = new Set<string>();
    const valid = [];
    for (const student of students) {
      if (
        typeof student?.sub !== "string" ||
        student.sub === "" ||
        typeof student.name !== "string" ||
        student.name === "" ||
        typeof student.group !== "string" ||
        student.group === "" ||
        seen.has(student.sub)
      ) {
        return { ok: false, reason: "invalid_snapshot" };
      }
      seen.add(student.sub);
      valid.push(student);
    }

    const currentActive = await storage.countActiveUsers();
    if (valid.length === 0 || (!options.overrideShrinkGuard && valid.length < currentActive * SHRINK_RATIO)) {
      console.error("[SSO] directory snapshot refused", {
        snapshot: valid.length,
        active: currentActive,
      });
      return { ok: false, reason: "shrink_guard" };
    }

    const result = await storage.replaceDirectorySnapshot(
      valid.map((student) => ({
        id: student.sub,
        name: student.name,
        group: student.group,
        image: student.image ?? null,
        isActive: student.idle !== true,
      })),
      evallyAdminIds(),
    );

    return { ok: true, ...result };
  } catch (error) {
    console.error(
      "[SSO] directory sync failed",
      error instanceof EvallyHttpError ? error.status : error instanceof Error ? error.message : error,
    );
    return { ok: false, reason: "upstream" };
  } finally {
    await db.execute(sql`select pg_advisory_unlock(${ADVISORY_LOCK_KEY})`);
  }
}

export function startDirectorySync(): void {
  if (!isDirectorySyncEnabled()) return;

  const minutes = Math.max(1, directoryConfig().syncIntervalMinutes);
  const tick = () => {
    runDirectorySync().catch((error) => {
      console.error("[SSO] directory sync tick failed", error);
    });
  };

  tick();
  setInterval(tick, minutes * 60 * 1000);
}
