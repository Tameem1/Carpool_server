---
name: Return Trip feature implementation
description: Trip classification, tab filtering, badge display, time type handling, and which server file actually handles POST /api/trips.
---

## Active route file
`server/new-routes.ts` handles all `/api/trips` routes at runtime (registered via `registerRoutes` in `server/index.ts`). `server/routes.ts` is dead code for trips — edits there have no effect.

## Trip classification field
`isReturnTrip: boolean("is_return_trip").default(false)` is in `shared/schema.ts`. The DB column is `is_return_trip`. Outbound trips get the default (false); the return-leg row is inserted with `isReturnTrip: true` explicitly in the transaction.

## returnTimeType field
`returnTimeType: varchar("return_time_type", { length: 20 })` is in `shared/schema.ts` (column `return_time_type`). Only set on return trips. Values: `"first_last"` (آخر شيء أول → 23:00 GMT+3 = 20:00 UTC), `"second_last"` (آخر شيء ثاني → 02:00 GMT+3 = 23:00 UTC), `"custom"` (driver-entered time). Outbound trips leave this null.

## Fixed-time anchoring rule
Fixed preset times (first_last/second_last) are anchored to the outbound trip's calendar date (`parsedTripData.departureTime`), NOT `new Date()`, to avoid calendar drift if trip date differs from server date.

## Two explicit .select() calls in storage.ts
`getUserTrips` and `getTodayUserTrips` in `server/storage.ts` enumerate columns manually in a join query. Any new column added to `trips` must be added to both selects or TypeScript will error. Currently includes: `returnTripId`, `isReturnTrip`, `returnTimeType`.

## Return trip creation pattern
In `server/new-routes.ts` POST /api/trips handler: after creating the outbound trip, check `req.body.returnTrip`. If present, validate `returnTimeType` ∈ {first_last, second_last, custom}; resolve departure time from type (custom requires a valid ISO departureTime); use `db.transaction()` to insert the return trip with `isReturnTrip: true` and `returnTimeType`, link both rows with mutual `returnTripId`. Wrap in try/catch so outbound always succeeds.

## TripCard display logic
For return trips, TripCard checks `returnTimeType`:
- `"first_last"` → display "آخر شيء أول"
- `"second_last"` → display "آخر شيء ثاني"
- `"custom"` or outbound → display formatted departure time
Sorting still uses the raw `departureTime` timestamp in Dashboard.

## Client-side (TripForm)
Return trip section uses local state: `addReturnTrip`, `returnTimeMode` ("first"/"second"/"custom"), `returnDepartureTime`, `returnFromLocation`, `returnToLocation`. Payload always includes `returnTrip` when toggle is on (for first/second modes no departure time is sent — server resolves it). If custom mode with no time entered, `onSubmit` shows a toast and blocks submission. Toggle only renders when `!trip?.id` (new trips only).

## Dashboard tab filtering
`isReturnTrip` is the reliable filter field. The three trip tabs (الجميع/الذهاب/العودة) share one rendered section — no TabsContent wrappers for those three, just `{activeTab !== "my-trips" && <div>}`. `my-trips` keeps its own `TabsContent`.

**Why:** Previously the outgoing/return tabs had no TabsContent so they showed nothing despite the filtering logic being correct.

## Schema migrations
After any schema change, run `npm run db:push`. The server must be restarted (not just hot-reloaded) to pick up schema changes — tsx's file watcher does not always restart on shared/schema.ts changes.
