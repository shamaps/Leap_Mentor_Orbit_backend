# Changelog

All notable changes to the LeapMentor backend are documented here.

### Added
- Shared integration-test fixture module (`__tests__/fixtures/createTestData.js`)
  providing factory functions (`makeUser`, `makeAdminUser`, `makeConnectRequest`,
  `makeSelectedSlot`, etc.) built directly on the real Mongoose models instead of the
  inline, hand-rolled mini-schemas each integration test file previously re-declared.
  This closes a drift risk: several inline test schemas had silently fallen out of
  sync with the real `User`/`ConnectRequest` models (missing required fields, wrong
  enums, no validation), meaning some integration tests could pass against a shape the
  real schema would reject.
- API smoke suite (`__tests__/smoke/api.smoke.test.js`) — a fast pass over ~37
  zero-path-param GET routes, hitting the real `app.js` (real middleware, real
  controllers, in-memory Mongo) with real signed JWTs for both regular-user and
  admin auth. Distinct from the existing integration suite: it checks that a route is
  mounted and doesn't crash, not the correctness of what it returns. Building and
  running this against the live app surfaced two real, previously-undetected
  production bugs (see Fixed, below) that the controller-mocked integration tests
  could not have caught.

### Changed
- `package.json`'s `test` script changed from `jest --runInBand` (fully serial) to
  `jest --maxWorkers=50%` (capped parallelism). `--runInBand` was likely added to
  avoid `mongodb-memory-server` resource contention on constrained hardware; capping
  workers at 50% gets most of the speed benefit of parallel execution while staying
  conservative enough to avoid the `MongoMemoryServer` boot-timeout failures that
  occur under uncapped (`--maxWorkers` default, one per core) parallelism on
  low-core-count machines. Verified: full suite (147 suites / 405 tests) still passes
  green after the change.

### Fixed
- **`repositories/connectRequest.repository.js` referenced an undefined
  `CONNECT_REQUEST_LIST_SELECT` constant** in `findMyRequests`, `findIncomingRequests`,
  and `findOngoingConnects`. This threw `ReferenceError: CONNECT_REQUEST_LIST_SELECT is
  not defined` on every call, surfacing as a 500 on `GET /connect-requests/my-requests`,
  `GET /connect-requests/incoming`, and `GET /connect-requests/ongoing` — i.e. a
  mentee or mentor viewing their own request list. The constant is now defined with
  the exact field projection `utils/mappers/connectRequest.mapper.js` reads
  downstream, plus the four foreign-key fields (`mentor`, `mentee`, `referredTo`,
  `referredBy`) needed for the subsequent `.populate()` calls to keep working.
  Found via the new smoke suite; none of the existing unit or integration tests for
  this service exercised these three functions, since 6 of `connectRequest.service.js`'s
  8 exported functions currently have zero test coverage.
- **`utils/cache.js`'s `get()` had a variable-scoping bug.** `raw` was declared with
  `const` inside the `try` block but referenced inside the `catch` block, where it's
  out of scope. Whenever `redisClient.get(key)` actually failed (e.g. Redis
  unreachable — reproducible locally with no Redis running), the intended fallback
  (`logger.warn(...); return null`) never ran; instead a *new*, uncaught
  `ReferenceError: raw is not defined` was thrown from inside the catch block itself,
  surfacing as a 500 on any route that reads through the cache —
  confirmed on `GET /admin/settings/overview` and `GET /admin/settings/commission`.
  Fixed by hoisting `let raw;` above the `try`. This one is a useful reminder that "is
  there a try/catch" isn't sufficient on its own — the catch block's own correctness
  needs checking too, since nothing in the unit suite exercises the Redis-failure path
  (Redis is mocked to always succeed in tests).

### Known issue carried forward (not fixed in this revision)
- `routes/push.routes.js` (and the push-notification feature it exposes) is fully
  implemented but never mounted in `app.js`. All three of its endpoints currently
  404. See README → Known Issues for the one-line fix.
- `PATCH /auth/password` has no Joi validation and no `changePasswordSchema` exists.
  See README → Known Issues.
- `middleware/noteAccess.js`'s two catch blocks still don't log the underlying error
  before returning a 500. See README → Known Issues.

---

## Reverted claims (previously documented as Fixed, found NOT to be true)

An earlier revision of this changelog claimed the following were fixed. On
inspection against the actual code, one was false and is now corrected above; the
other two checked out and are restated here for the record:

- ~~"Fixed two silent `catch` blocks in `middleware/noteAccess.js` that returned a 500
  response without logging the underlying error."~~ — **Not true as of this audit.**
  Both catch blocks in `noteAccess.js` still return a bare 500 with no `logger` call,
  and the file has no `logger` import at all. Re-opened; tracked in Known Issues
  rather than re-claimed as fixed, since it hasn't actually been touched yet.
- "Fixed `routes/ai.routes.js` referencing an unimported `fail()` helper" —
  **confirmed true.** `fail` is correctly imported and used for the timeout/error
  paths in `routes/ai.routes.js`.
- "Fixed a typo (`catchError` instead of `handleError`) in the mentee profile creation
  error path" — **confirmed true.** `controllers/menteeProfile.controller.js`
  consistently uses `handleError` across all four of its handlers.
- "Joi-based request validation at the route boundary for all auth endpoints
  (register, login, change-password, forgot-password flow)" — **partially true.**
  `register`, `login`, and the three-step password-reset flow
  (`password-reset` / `password-reset/verification` / `password-reset/confirmation`)
  are all properly Joi-validated. `change-password` (`PATCH /auth/password`) is not —
  see Known Issues. The original claim's reference to "forgot-password" as a single
  step also undersold what's actually a 3-endpoint flow.

---

## [1.0.0] — Initial documented baseline

### API
- Versioned under `/api/v1`.

### Authentication
- Email/password registration and login, with bcrypt password hashing.
- Google OAuth and Clerk SSO (LinkedIn, Apple) sign-in.
- Email verification via OTP and magic link.
- Access tokens issued as short-lived JWTs, kept in memory on the frontend (Redux),
  never persisted to localStorage.
- Refresh tokens stored as hashes in MongoDB, delivered to the client as an HttpOnly
  cookie, with rotation on every refresh.
- Three-step forgot-password flow via OTP (`password-reset` →
  `password-reset/verification` → `password-reset/confirmation`), with its own rate
  limiting at each step.
- Separate admin authentication system (`AdminUser` model, `adminAccessToken` cookie,
  `role: "admin"` JWT claim) — distinct from the regular user auth flow above.

### Core domain
- Mentor and mentee profile management.
- Slot-based mentor availability (weekly schedule + specific-date overrides), with
  TTL-backed slot locking during checkout (`/slot-locks`) to prevent double-booking.
- Connect-request lifecycle: send → accept/reject/refer → escrow → session → complete.
- Escrow-based payment system with per-role wallets, commission rates, and transaction
  history.
- Session scheduling, feedback, and ratings.
- Goals and milestones tracking per connect request.
- Shared and private notes per mentor-mentee connection.
- Real-time chat via Socket.IO, authenticated via JWT at the socket layer.
- PDF invoice generation.
- Web Push notification infrastructure (VAPID) — implemented at the route/controller/
  service level, but see Known Issues for its current mounting gap.
- Google Calendar integration — mentors can connect their calendar to sync
  availability and sessions; OAuth tokens encrypted at rest (see below).
- LeapBuddy AI assistant, proxied through Groq's LLaMA-based chat API, with trace-ID
  forwarding for end-to-end log correlation.
- Admin panel: user management, report resolution (including refunds and session
  deletion), mentor verification workflow, platform commission settings, payment and
  engagement reports, leap-request (mentor application) approval.

### Reliability & observability
- Winston logging with a BetterStack (Logtail) transport and Sentry error reporting.
- `X-Trace-Id` request tracing via `AsyncLocalStorage` — every log line for a request
  is automatically tagged with the same trace ID without manually threading it through
  controllers/services/repositories. Inbound `X-Trace-Id`/`X-Request-Id` headers are
  honored if present; a new UUID v4 is generated otherwise.
- Process-level `uncaughtException`/`unhandledRejection` handlers in `server.js`,
  both reporting to Sentry. `uncaughtException` distinguishes operational errors
  (`AppError`, expected/handled) from programmer errors — only the latter triggers a
  process exit.
- Centralized error handling (`utils/appError.js`'s `AppError` + `handleError`)
  distinguishing operational errors (4xx, expected) from unexpected/programmer errors,
  used consistently across all but one controller (the one exception has no fallible
  operation to catch).
- Centralized response-shape utilities (`ok`/`created`/`fail`/`unprocessable`) used
  across controllers.
- Redis-backed rate limiting, global and per-route (login, registration, OTP, OAuth,
  forgot-password, AI chat, uploads, reports, support, admin login).
- Retry-with-backoff wrapper (`utils/withRetry.js`) applied to Cloudinary uploads,
  Google Calendar API calls, outbound email sending, and Clerk SSO user lookups.
- AES-256-GCM encryption for stored Google Calendar OAuth tokens
  (`Availability.googleCalendarToken`).

### Security
- Helmet middleware (CSP, HSTS, X-Frame-Options, etc.).
- MongoDB injection protection via `express-mongo-sanitize`.
- CORS restricted to an explicit allowlist from environment variables.
- Sensitive fields (passwords, tokens, OTPs) redacted from log output.
- `Cookie`-scoped, HttpOnly refresh tokens (no token material in localStorage).

### Testing
- Jest + Supertest + `mongodb-memory-server`, with a clean separation between
  dependency-mocked unit tests and DB-backed integration tests.
- Swagger/OpenAPI 3.0 spec covering the full route surface, generated via
  `swagger-jsdoc` from inline `@openapi` annotations, served at `/api-docs`.

---

## Migration notes

### Encrypting existing Google Calendar tokens
Any `Availability` document with a pre-existing plain-text `googleCalendarToken`
(written before the AES-256-GCM encryption change) must be migrated — either via a
one-off script that encrypts existing values in place, or by having affected mentors
disconnect and reconnect their Google Calendar. Attempting to decrypt an
un-migrated plain-text value will throw, since it was never encrypted by
`utils/tokenCrypto.js` in the first place.

### Required environment variable for calendar token encryption
`CALENDAR_TOKEN_ENC_KEY` — a 64-character hex string (32 bytes), used to
encrypt/decrypt stored Google Calendar OAuth tokens. Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Note: `config/env.js` treats this variable as optional and won't itself complain if
it's missing — the actual enforcement happens inside `utils/tokenCrypto.js`, which
validates the key at module-load time and throws if it's missing or malformed. Since
that module is loaded eagerly (via `config/container.js`, required by `app.js` at
boot), the practical effect is the same: the app fails to start without a valid key.
