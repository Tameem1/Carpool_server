# Migrating Cars to Login with Evally

**Status:** plan. No code, schema, or data change made yet.
**Premise:** the Cars schema and user data are disposable. Preserve the `trips`
rows if practical, but carry no Cars user accounts into the new identity model.
Legacy trip user references may be cleared.
**Depends on:** `leaderboard-api/docs/login-with-evally.md`, especially steps 2,
5, and 6.

## The idea

Cars stops owning identity. It keeps no passwords, invents no user ids, and runs
no login form of its own. Its `users` table becomes a **projection** of the
Evally student roster plus the handful of attributes that are genuinely Cars'
own — role, Telegram link, preferred departure window.

Two independent channels do the work through two different OAuth clients. It
matters that neither the credentials nor capabilities are shared:

| Channel | Answers | How |
| --- | --- | --- |
| **Directory sync** | who exists | directory client: `client_credentials` → `GET /api/sso/directory`, every 15 minutes |
| **Login** | who is at the door | login client: Authorization Code + PKCE → `GET /api/sso/me` |

Login alone cannot fill a roster — it only ever describes one person, once. The
driver's passenger picker, admin trip assignment, and the shortage digest all
need everyone, including people who have never opened Cars. That is what the
sync is for, and it is why the sync ships first.

## New schema

Rewritten, not migrated in place. `npm run db:push` against a fresh database,
then import only a sanitized copy of legacy `trips`.

```ts
export const users = pgTable("users", {
  // From Evally. id IS the Evally subject (students.id) — Evally is the only
  // source of user rows, so there is no second namespace to collide with.
  id: varchar("id").primaryKey().notNull(),
  name: varchar("name").notNull(),
  group: varchar("group").notNull(),
  image: varchar("image"),
  isActive: boolean("is_active").notNull().default(true),
  syncedAt: timestamp("synced_at").defaultNow().notNull(),

  // Cars-owned. Never touched by the sync.
  role: varchar("role", { enum: ["user", "admin"] }).notNull().default("user"),
  phoneNumber: varchar("phone_number"),
  telegramUsername: varchar("telegram_username"),
  telegramId: varchar("telegram_id"),
  preferredDepartureStart: varchar("preferred_departure_start"),
  preferredDepartureEnd: varchar("preferred_departure_end"),
  lastLoginAt: timestamp("last_login_at"),
});
```

Gone: `password`, `section`, `username`.

`username` → `name` and `section` → `group` is a rename worth doing. It spans
the active server, storage layer, shared types, Telegram messages, and client
components; it is broader than the schema edit, so TypeScript compilation and
the regression suite are the completion criteria. The whole point is that Cars
stops keeping its own vocabulary for Evally's concepts.

New records in `rideRequests.riderId`, `tripParticipants.userId`,
`slotRegistrations.driverId`, `notifications.userId`, and
`shortageAlertRecipients.userId` keep using `users.id`, which is now the Evally
subject. Those tables start empty at cutover.

`trips` changes slightly so old rows can survive without inventing mappings from
deleted Cars accounts:

```ts
driverId: varchar("driver_id"),                    // nullable for legacy rows
riders: text("riders").array().default([]),
isLegacy: boolean("is_legacy").notNull().default(false),
```

Imported trips retain ids, locations, times, recurrence/return metadata, notes,
seat totals, and timestamps. They get `driverId = null`, `riders = []`,
`availableSeats = totalSeats`, and `isLegacy = true`. Legacy trips are read-only
and excluded from active-trip, matching, notification, join, and scheduling
workflows. History rendering must tolerate a missing driver and show a neutral
label such as “سائق سابق”. The database nullability exists only for that import:
the create-trip request and service still require a real active driver whenever
`isLegacy=false`, and clients cannot set `isLegacy` themselves.

`role` collapses from `["user","admin","student"]` to `["user","admin"]`;
nothing reads the third value.

**Rows are deactivated, never deleted.** A user who leaves Evally still has trips
and notifications pointing at them. `isActive: false` hides them from every
picker and leaves history readable.

## What gets deleted

The satisfying part — this migration removes considerably more than it adds.

| File | Why |
| --- | --- |
| `server/auth.ts` | Dead demo login. Not imported anywhere, hard-codes a session secret, and `POST /api/demo-login` accepts any `userId`. Should go regardless of this plan. |
| `server/replitAuth.ts` | Dead. |
| `server/simple-auth.js` | Dead. |
| `server/routes.ts` | Dead duplicate; `server/index.ts` imports `new-routes.ts`. Keeping two route implementations makes auth cleanup ambiguous. |
| `server/db-local.ts` | Unused alternate database module. |
| `server/new-auth.ts`, `server/auth-utils.ts` | The active Passport-local strategy and password helpers. Replaced by `server/session.ts`. |
| `server/hash-passwords.ts`, `migrate-passwords.ts`, `batch-migrate-passwords.ts`, `quick-migrate-passwords.ts`, `final-password-migration.ts`, `final-password-fix.js`, `complete-password-migration.ts`, `sql-password-migration.ts` | Eight scripts for a password column that no longer exists. |
| `server/populate-users.ts` | The directory sync replaces it. |
| `users_table.sql`, `users_data.sql`, `attached_assets/updated_users_*.json` | 346 bcrypt hashes, real names, and Telegram ids, currently **tracked in git**. Delete from the working tree; decide separately whether history needs rewriting. |
| `GET /api/auth/sections`, `GET /api/auth/users/:section` | They exist only to feed the old login picker, and they enumerate users unauthenticated. |
| `POST /api/auth/login`, `POST /api/users`, sample-user initialization | Password login, local account creation, and hard-coded demo users all violate Evally ownership. Remove them from active `new-routes.ts`/`storage.ts`. |
| `client/src/components/AddUserDialog.tsx` | Users come from Evally now. Replaced by a role-assignment dialog over existing users. |
| Deps and types: `bcryptjs`, `passport`, `passport-local`, `openid-client`, `@types/bcryptjs`, `@types/passport`, `@types/passport-local` | `express-session` and `connect-pg-simple` remain. OAuth here is two documented HTTP exchanges, not OIDC discovery or ID-token verification. |

## What gets added

| File | Purpose |
| --- | --- |
| `server/evally/client.ts` | Typed, timeout-bound HTTP calls. Uses the directory credentials only for `client_credentials` and the login credentials only for code exchange. |
| `server/evally/login.ts` | `GET /api/auth/login` and `GET /api/auth/callback`. |
| `server/evally/directory-sync.ts` | Snapshot pull, overlap lock, transaction, upsert/deactivate, and shrink guardrails. |
| `server/session.ts` | Session middleware and `isAuthenticated`, replacing Passport.js. |
| `scripts/export-legacy-trips.ts` | Read-only export with row count and SHA-256 checksum. Never exports users or passwords. |
| `scripts/import-legacy-trips.ts` | Validates and transforms the export, inserts legacy trips, and resets the `trips.id` sequence. |

The active `server/new-routes.ts` also changes in place:

- `GET /api/users` returns an explicit public projection, never storage rows,
  and excludes inactive users from picker responses.
- `PATCH /api/users/:id/role` is added for admins. It accepts only `user` or
  `admin` and cannot demote an id listed in `CARS_ADMIN_EVALLY_IDS`.
- `PATCH /api/users/profile` accepts only Cars-owned profile fields, including
  `phoneNumber`, `telegramUsername`, and `preferredDepartureStart/End`;
  `telegramId` remains writable only by the Telegram verification flow. The
  profile route cannot change Evally-owned name, group, image, id, or active
  state.
- The existing preferred-time UI is tested against that handler. Preferred-time
  notification behavior that exists only in dead `server/routes.ts` is not
  silently promised by this migration.

New environment variables:

```
EVALLY_BASE_URL=https://api.evally.net
EVALLY_LOGIN_CLIENT_ID=<authorization-code client uuid>
EVALLY_LOGIN_CLIENT_SECRET=<shown once>
EVALLY_LOGIN_REDIRECT_URI=https://cars.evally.net/api/auth/callback
EVALLY_DIRECTORY_CLIENT_ID=<client-credentials client uuid>
EVALLY_DIRECTORY_CLIENT_SECRET=<shown once>
CARS_PUBLIC_ORIGIN=https://cars.evally.net
CARS_ADMIN_EVALLY_IDS=66,5
DIRECTORY_SYNC_INTERVAL_MINUTES=15
CARS_DIRECTORY_SYNC_ENABLED=false
CARS_EVALLY_LOGIN_ENABLED=false
```

The login client has only `authorization_code` + `identity`. The directory
client has only `client_credentials` + `directory` and its server-side group
grants. Cars needs every Evally halaqa unless product policy says otherwise, so
register it with `all_groups=true`; that also lets newly enrolled students sign
in before the next scheduled sync without duplicating a group allow-list in
Cars. Neither secret is exposed to Vite or any `VITE_*` variable. Cars' two
local flags are independent of Evally's `SSO_DIRECTORY_ENABLED` and
`SSO_LOGIN_ENABLED`: the upstream capability is enabled first, then the matching
Cars consumer is enabled.

## Directory sync

```
every 15 min, and once during deployment preflight:
  lock     = acquire process/advisory lock; skip if another run owns it
  token    = client_credentials(scope=directory) using DIRECTORY client
             # cache until shortly before expires_at; on 401 clear and retry once
  snapshot = GET /api/sso/directory with timeout and size limit
  validate → generated_at parseable; unique non-empty sub/name/group fields
  guard    → refuse the whole run if the snapshot is empty,
             or smaller than 50% of the current active count
  transaction:
    upsert → id = sub, name, group, image, is_active = !idle, synced_at
             (role, phone, telegram_*, preferred_* left untouched)
    sweep  → is_active = false for any local id absent from the snapshot
    admins → role = 'admin' for every id in CARS_ADMIN_EVALLY_IDS
```

The shrink guard is the important line. Without it, one malformed response or a
half-finished deploy on the Evally side deactivates the entire roster and every
picker in Cars goes empty. Upsert and sweep are one transaction, and runs cannot
overlap. On refusal: log, alert, keep the previous roster, try again next
interval. A stale roster is always better than an empty one. A deliberate
greater-than-50% scope reduction needs an explicit one-run operator override.

Admin designation lives in the environment rather than in a table, matching how
the other server-side flags in this stack are handled. The env list is a floor —
an admin can promote someone else in the UI, but cannot demote an env admin,
which keeps a lockout from being possible. Cars owns roles entirely; Evally's
`permissions` are not consulted.

## Login flow

```
GET /api/auth/login
  state    = base64url(32 random bytes) -> session
  verifier = base64url(32 random bytes) -> session  # 43 chars, RFC 7636 minimum
  save the session before redirecting
  302 -> {EVALLY}/oauth/authorize
           ?response_type=code&client_id&redirect_uri
           &scope=identity&state&code_challenge&code_challenge_method=S256

GET /api/auth/callback?code&state
  code/state must each be one string
  state must match and state+verifier are consumed once (else 400, no exchange)
  POST {EVALLY}/oauth/token               (LOGIN client auth + verifier +
                                           exact EVALLY_LOGIN_REDIRECT_URI)
  keep access_token; discard refresh_token without logging or storing it
  GET  {EVALLY}/api/sso/me                (Bearer)
  validate sub/name/group; Evally has already refused an idle student
  upsert only Evally-owned user fields    (creates it if the sync has not seen
                                           a new student yet)
  set isActive=true, regenerate session id
  set session.userId, last_login_at=now, save session
  302 -> /
```

`state` and the verifier never leave the server except as the S256 challenge.
The exchange is server-to-server with the client secret. That is the entire
client side, implemented with `node:crypto` and `fetch`, with no OAuth library:
there is no discovery document or ID token to validate. Every upstream request
has a short timeout, bounded response size, explicit status/content validation,
and redacted logs.

Passport authorization codes are valid for ten minutes and are one-time. Access
tokens last 30 minutes; Cars uses the login token immediately for `/me`, then
relies on its own session. `/me` v1 maps only `sub`, `name`, `group`, and `image`
(plus optional ignored `permissions`) and has no `auth_method` or `auth_time`.

### Session

Keep `express-session` on the existing `connect-pg-simple` store. Drop
Passport.js: a middleware reads `session.userId`, loads an active user, and
populates `req.user` so every downstream `req.user.id` and `req.user.role` keeps
working. Remove `req.isAuthenticated()` checks and use the single
`isAuthenticated` middleware contract everywhere.

Cars' session lifetime is Cars'. Logging out of Cars does not touch the Evally
session, and vice versa. Shorten the current one-year cookie to something
defensible (a week) while the code is open anyway. Production requires
`SESSION_SECRET` with no fallback, `app.set("trust proxy", ...)` for only the
deployment proxy, and a host-only cookie with `Secure`, `HttpOnly`, and
`SameSite=Lax`. Save before the OAuth redirect and regenerate after callback.
Logout is POST, destroys the server session, and clears the cookie.

Because sibling `*.evally.net` sites are same-site, `SameSite` alone is not a
complete CSRF boundary. Unsafe Cars methods must reject an unexpected
`Origin`/`Referer` (or use CSRF tokens), and CORS must not allow credentialed
requests from arbitrary origins.

## Client changes

| File | Change |
| --- | --- |
| `LoginForm.tsx` | Three fields and a password box become one button: «الدخول عبر إفالي» → `/api/auth/login`. |
| `AddUserDialog.tsx` | Becomes a role-assignment dialog over synced users. No creation, no password. |
| `TripForm.tsx`, `ShortageRecipients.tsx`, `SlotDetailsDialog.tsx` | `section` → `group`; filter pickers on `isActive`. |
| `UserProfile.tsx` | Name, group, and `image` become the canonical fields (`profileImageUrl` is removed); identity fields are read-only. Telegram and preferred times stay editable through the corrected profile handler. |
| `TripCard.tsx`, dashboards, `TripJoinRequestForm.tsx`, `RideRequestForm.tsx`, `searchable-user-select.tsx`, `server/telegram.ts` | Complete the live `username`→`name` and `section`→`group` rename in rendering, filtering, and messages. |
| `useAuth.ts` | The auth bootstrap's 401 redirects to `/api/auth/login`; logout remains a Cars-only POST. |

Group stays visible next to names in the pickers — first names collide often
enough in this roster that it is doing real disambiguation work.

## Cutover

There is no account migration or dual identity run. The old database remains the
rollback artifact, while trips get an explicit export/import path.

1. Evally ships steps 1–2. Register the Cars directory client, enable Evally
   `SSO_DIRECTORY_ENABLED`, then enable Cars
   `CARS_DIRECTORY_SYNC_ENABLED` and verify a full all-groups snapshot.
2. Build Cars against a scratch Postgres database: new schema, transactional
   sync, session/login callback, UI rename, and legacy-trip import.
3. Run the trip exporter against a disposable copy of production. Import into
   scratch and verify row count, selected field checksums, preserved return-trip
   links, null drivers, empty riders, reset sequence, and read-only behavior.
4. Evally completes steps 3–5, including idle revocation and browser/OAuth
   hardening. Register the separate Cars login client but leave both Evally
   `SSO_LOGIN_ENABLED=false` and Cars `CARS_EVALLY_LOGIN_ENABLED=false`.
5. End-to-end scratch test: directory sync, login, logout, expired session,
   driver trip creation, passenger selection, admin role, and upstream failure.
6. **Cutover:** stop Cars writes; create an encrypted full `pg_dump` rollback
   archive; export `trips` with checksum; provision a fresh database; run
   `npm run db:push`; import sanitized legacy trips; run one directory sync;
   verify trip count, roster and admin list.
7. Deploy Cars, enable Evally `SSO_LOGIN_ENABLED`, then Cars
   `CARS_EVALLY_LOGIN_ENABLED`; run smoke tests, then reopen writes. Roll back by
   restoring the untouched dump and previous deployment if the smoke test fails.
8. Keep the encrypted full dump under restricted access for one month, then
   delete it because it contains password hashes and Telegram ids. The sanitized
   trip export may follow the normal backup retention policy.

Only trip rows are carried over. Their old driver and rider identifiers are
removed rather than mapped. Ride requests, participants/join requests,
notifications, schedule slots/registrations, shortage recipients, sessions, and
users start empty.

## Resolve before cutover

**Cars has sections that do not appear among Evally's group keys** — `dubai-omar`,
`jaddubai`, and `other`, covering roughly 36 of the current 346 accounts. If those
people are not students in Evally, they cannot exist in Cars under this design.
Check them against the live `groups` table first. Three ways out, in order of
preference:

1. They are students in groups I could not see from the code — nothing to do.
2. Give them Evally student records. Keeps one identity source, which is the
   whole point.
3. Allow Cars-local accounts alongside synced ones. **This is the expensive
   option**: a second source of user rows means `users.id` can no longer safely
   be the Evally subject, and you are back to a separate `evally_sub` column with
   a uniqueness constraint. Worth it only if a real population of non-students
   needs to drive.

## Tests

Cars currently has no automated test runner or test files. Add a small server
test harness (for example Vitest with an isolated Postgres database) before
calling these checks automated; until then this section is a mandatory manual
cutover checklist.

**Sync**
- snapshot upserts new users, updates changed names and groups
- `role`, `telegramId`, `preferredDeparture*` survive a sync untouched
- a user absent from the snapshot is deactivated, not deleted; their trips still resolve
- `idle` in Evally deactivates locally
- empty or short snapshot is refused and the previous roster survives
- a failed token request or a 500 leaves the roster intact
- concurrent runs do not overlap; upsert and sweep commit or roll back together
- login credentials cannot obtain a directory token and directory credentials cannot exchange a code
- directory sync stays off while `CARS_DIRECTORY_SYNC_ENABLED=false`
- `CARS_ADMIN_EVALLY_IDS` applies on every run

**Login**
- full round trip creates the session and lands on `/`
- missing, altered, or replayed `state` is rejected before any exchange
- a wrong verifier fails the exchange
- callback rejects array/malformed parameters and upstream timeouts safely
- callback handles OAuth `error` responses locally without reflecting unsafe text
- returned refresh token is neither stored nor logged and cannot be redeemed by the login client
- a student not in the last snapshot is created on login
- an idle/deleted Evally student cannot complete `/me` and no Cars session is created
- login routes/UI stay unavailable while `CARS_EVALLY_LOGIN_ENABLED=false`
- logging out of Cars leaves the Evally session alone
- a user id posted by the browser is ignored everywhere
- session id rotates, the cookie is secure in production, and hostile origins cannot perform Cars writes

**Legacy trips**
- export contains only `trips`, a row count, and checksum
- import preserves ids and non-user trip fields, clears driver/riders, restores the id sequence
- legacy trips are read-only and excluded from active matching, joining, and notifications
- new trips still require an active driver and cannot set `isLegacy`
- a failed or partial import rolls back and does not leave a half-filled database

**Regression** — the point of the whole exercise
- driver creates a trip and adds passengers from the picker
- admin assigns a ride request to a trip
- join request → approval → participant
- Telegram linking, notifications, and the shortage digest still resolve users
- `GET /api/users` never exposes private storage fields and picker responses omit inactive users
- role assignment works and an environment admin cannot be demoted
- profile updates persist preferred departure times without changing Evally identity fields
- schedule slots and driver registrations
- WebSocket broadcasts still carry resolvable user ids

## Net effect

Cars ends up with one fewer subsystem than it started with. It gains a sync job,
a callback, and a small trip-preservation utility; it loses passwords, hashing,
local login/account creation, a user directory of its own, obsolete dependencies,
and the duplicate/dead auth files.
