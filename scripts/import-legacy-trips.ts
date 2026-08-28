import { readFile } from "node:fs/promises";
import { sql } from "drizzle-orm";
import { db } from "../server/db";
import { trips } from "../shared/schema";
import {
  sanitizeLegacyTrip,
  validateExport,
  type LegacyTripExport,
} from "./legacy-trips";

async function main() {
  const path = process.argv[2];
  if (!path) {
    throw new Error("Usage: tsx scripts/import-legacy-trips.ts <export.json>");
  }

  const payload = JSON.parse(await readFile(path, "utf8")) as LegacyTripExport;
  validateExport(payload);

  const sanitized = payload.trips.map((row) => sanitizeLegacyTrip(row as Record<string, unknown>));

  await db.transaction(async (tx) => {
    if (sanitized.length === 0) return;

    for (const trip of sanitized) {
      await tx.insert(trips).values({
        id: Number(trip.id),
        driverId: null,
        riders: [],
        isLegacy: true,
        fromLocation: String(trip.fromLocation),
        toLocation: String(trip.toLocation),
        departureTime: new Date(String(trip.departureTime)),
        availableSeats: Number(trip.availableSeats),
        totalSeats: Number(trip.totalSeats),
        isRecurring: Boolean(trip.isRecurring),
        recurringDays: trip.recurringDays == null ? null : String(trip.recurringDays),
        notes: trip.notes == null ? null : String(trip.notes),
        returnTripId: trip.returnTripId == null ? null : Number(trip.returnTripId),
        isReturnTrip: Boolean(trip.isReturnTrip),
        returnTimeType: trip.returnTimeType == null ? null : String(trip.returnTimeType),
        createdAt: trip.createdAt ? new Date(String(trip.createdAt)) : new Date(),
        updatedAt: trip.updatedAt ? new Date(String(trip.updatedAt)) : new Date(),
      });
    }

    await tx.execute(sql`SELECT setval(pg_get_serial_sequence('trips', 'id'), COALESCE((SELECT MAX(id) FROM trips), 1))`);
  });

  console.log(`Imported ${sanitized.length} legacy trips`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
