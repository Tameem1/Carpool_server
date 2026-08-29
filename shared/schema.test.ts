import { describe, expect, it } from "vitest";
import { insertTripSchema } from "./schema";

const payload = (overrides: Record<string, unknown> = {}) => ({
  fromLocation: "test",
  toLocation: "النادي",
  departureTime: "2026-08-29T17:59:00.000Z",
  availableSeats: 4,
  totalSeats: 4,
  isRecurring: false,
  recurringDays: [],
  participantIds: [],
  riders: [],
  ...overrides,
});

describe("insertTripSchema", () => {
  it('accepts the blank driverId the form sends when you are the driver', () => {
    const parsed = insertTripSchema.parse(payload({ driverId: "" }));

    // Absent, not "" — so the route falls back to the current user.
    expect(parsed.driverId).toBeUndefined();
  });

  it("accepts a driver an admin picked", () => {
    expect(insertTripSchema.parse(payload({ driverId: "384" })).driverId).toBe("384");
  });

  it("treats a whitespace-only driverId as blank rather than a real id", () => {
    expect(insertTripSchema.parse(payload({ driverId: "   " })).driverId).toBeUndefined();
  });

  it("still requires the fields a trip cannot do without", () => {
    expect(() => insertTripSchema.parse(payload({ fromLocation: undefined }))).toThrow();
  });
});
