import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const countActiveUsers = vi.fn();
const replaceDirectorySnapshot = vi.fn();
const fetchDirectorySnapshot = vi.fn();

vi.mock("../db", () => ({
  db: { execute },
}));

vi.mock("../storage", () => ({
  storage: {
    countActiveUsers,
    replaceDirectorySnapshot,
  },
}));

vi.mock("./client", () => ({
  fetchDirectorySnapshot,
  EvallyHttpError: class EvallyHttpError extends Error {
    constructor(message: string, readonly status?: number) {
      super(message);
    }
  },
}));

describe("directory sync", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.CARS_DIRECTORY_SYNC_ENABLED = "true";
    process.env.CARS_ADMIN_EVALLY_IDS = "66";
    execute.mockResolvedValue({ rows: [{ locked: true }] });
    countActiveUsers.mockResolvedValue(10);
    replaceDirectorySnapshot.mockResolvedValue({ upserted: 10, deactivated: 0 });
  });

  afterEach(() => {
    delete process.env.CARS_DIRECTORY_SYNC_ENABLED;
    vi.clearAllMocks();
  });

  it("stays off while CARS_DIRECTORY_SYNC_ENABLED is false", async () => {
    process.env.CARS_DIRECTORY_SYNC_ENABLED = "false";
    const { runDirectorySync } = await import("./directory-sync");
    const result = await runDirectorySync();
    expect(result).toEqual({ ok: false, reason: "disabled" });
    expect(fetchDirectorySnapshot).not.toHaveBeenCalled();
  });

  it("refuses an empty or short snapshot", async () => {
    fetchDirectorySnapshot.mockResolvedValue({
      generated_at: new Date().toISOString(),
      students: [
        { sub: "1", name: "A", group: "g1" },
        { sub: "2", name: "B", group: "g1" },
      ],
    });
    const { runDirectorySync } = await import("./directory-sync");
    const result = await runDirectorySync();
    expect(result).toEqual({ ok: false, reason: "shrink_guard" });
    expect(replaceDirectorySnapshot).not.toHaveBeenCalled();
  });

  it("refuses a snapshot generated too long ago", async () => {
    fetchDirectorySnapshot.mockResolvedValue({
      generated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
      students: Array.from({ length: 10 }, (_, i) => ({
        sub: String(i + 1),
        name: `User ${i + 1}`,
        group: "g1",
      })),
    });
    const { runDirectorySync } = await import("./directory-sync");
    const result = await runDirectorySync();
    expect(result).toEqual({ ok: false, reason: "stale_snapshot" });
    expect(replaceDirectorySnapshot).not.toHaveBeenCalled();
  });

  it("upserts a valid snapshot and applies env admins", async () => {
    const students = Array.from({ length: 10 }, (_, i) => ({
      sub: String(i + 1),
      name: `User ${i + 1}`,
      group: "g1",
      idle: i === 9,
    }));
    fetchDirectorySnapshot.mockResolvedValue({
      generated_at: new Date().toISOString(),
      students,
    });
    const { runDirectorySync } = await import("./directory-sync");
    const result = await runDirectorySync();
    expect(result.ok).toBe(true);
    expect(replaceDirectorySnapshot).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: "1", isActive: true }),
        expect.objectContaining({ id: "10", isActive: false }),
      ]),
      ["66"],
    );
  });
});
