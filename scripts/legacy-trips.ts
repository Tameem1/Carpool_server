import crypto from "node:crypto";

export type LegacyTripExport = {
  exportedAt: string;
  count: number;
  checksum: string;
  trips: unknown[];
};

export function canonicalJson(value: unknown): string {
  return JSON.stringify(value);
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function checksumTrips(trips: unknown[]): string {
  return sha256Hex(canonicalJson(trips));
}

export function sanitizeLegacyTrip(row: Record<string, unknown>): Record<string, unknown> {
  const totalSeats = Number(row.totalSeats ?? row.total_seats ?? 0);
  return {
    id: row.id,
    driverId: null,
    riders: [],
    isLegacy: true,
    fromLocation: row.fromLocation ?? row.from_location,
    toLocation: row.toLocation ?? row.to_location,
    departureTime: row.departureTime ?? row.departure_time,
    availableSeats: totalSeats,
    totalSeats,
    isRecurring: row.isRecurring ?? row.is_recurring ?? false,
    recurringDays: row.recurringDays ?? row.recurring_days ?? null,
    notes: row.notes ?? null,
    returnTripId: row.returnTripId ?? row.return_trip_id ?? null,
    isReturnTrip: row.isReturnTrip ?? row.is_return_trip ?? false,
    returnTimeType: row.returnTimeType ?? row.return_time_type ?? null,
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at,
  };
}

export function validateExport(payload: LegacyTripExport): void {
  if (!Array.isArray(payload.trips)) {
    throw new Error("Export is missing trips");
  }
  if (payload.count !== payload.trips.length) {
    throw new Error(`Export count ${payload.count} does not match ${payload.trips.length} trips`);
  }
  const checksum = checksumTrips(payload.trips);
  if (payload.checksum !== checksum) {
    throw new Error("Export checksum does not match trip rows");
  }
}
