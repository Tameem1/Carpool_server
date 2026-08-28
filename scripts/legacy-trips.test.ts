import { describe, expect, it } from "vitest";
import {
  checksumTrips,
  sanitizeLegacyTrip,
  validateExport,
} from "./legacy-trips";

describe("legacy trip export/import", () => {
  it("checksums only trip rows", () => {
    const trips = [{ id: 1, fromLocation: "A" }, { id: 2, fromLocation: "B" }];
    const payload = {
      exportedAt: "2026-01-01T00:00:00.000Z",
      count: 2,
      checksum: checksumTrips(trips),
      trips,
    };
    expect(() => validateExport(payload)).not.toThrow();
    expect(() => validateExport({ ...payload, count: 1 })).toThrow(/count/);
    expect(() => validateExport({ ...payload, checksum: "nope" })).toThrow(/checksum/);
  });

  it("clears driver and riders and marks the row legacy", () => {
    const sanitized = sanitizeLegacyTrip({
      id: 9,
      driverId: "old-user",
      riders: ["a", "b"],
      fromLocation: "X",
      toLocation: "Y",
      totalSeats: 4,
      availableSeats: 1,
    });
    expect(sanitized.driverId).toBeNull();
    expect(sanitized.riders).toEqual([]);
    expect(sanitized.isLegacy).toBe(true);
    expect(sanitized.availableSeats).toBe(4);
  });
});
