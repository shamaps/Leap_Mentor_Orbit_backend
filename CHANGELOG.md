# Changelog

All notable changes to the LeapMentor backend are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- Joi-based request validation at the route boundary for all auth endpoints
  (register, login, change-password, forgot-password flow), replacing manual
  presence-only checks with proper email/length/format validation and
  field-level error responses.
- `X-Trace-Id` request tracing via `AsyncLocalStorage` — every log line for a
  request is automatically tagged with the same trace ID, without needing to
  pass it manually through controllers/services/repositories. Inbound
  `X-Trace-Id` / `X-Request-Id` headers are honored if present; a new UUID v4
  is generated otherwise. The same trace ID is now forwarded to the Groq AI
  proxy call for end-to-end correlation.
- Swagger / OpenAPI documentation, served at `/api/v1/docs`, generated via
  `swagger-autogen` from live route annotations.
- AES-256-GCM encryption for stored Google Calendar OAuth tokens
  (`Availability.googleCalendarToken`), previously stored as plain text.
- Process-level `uncaughtException` / `unhandledRejection` handlers, both
  reporting to Sentry. `uncaughtException` distinguishes operational errors
  (`AppError`, expected/handled) from programmer errors — only the latter
  triggers a process exit.
- Retry-with-backoff wrapper (`utils/withRetry.js`) applied to Cloudinary
  uploads, Google Calendar API calls, outbound email sending, and Clerk SSO
  user lookups.

### Changed
- MongoDB connection failure at startup now exits the process instead of
  continuing to accept requests against an unreachable database.
- `/users/me` and `/images/profile/:userId` moved out of inline route
  handlers into proper controller/service layers.

### Fixed
- Fixed `routes/ai.routes.js` referencing an unimported `fail()` helper,
  which caused an unhandled `ReferenceError` on any Groq API timeout or
  non-2xx response instead of returning the intended error response.
- Fixed a typo (`catchError` instead of `handleError`) in the mentee profile
  creation error path.
- Fixed two silent `catch` blocks in `middleware/noteAccess.js` that returned
  a 500 response without logging the underlying error.

---

## [1.0.0] — Initial documented baseline

### API
- Versioned under `/api/v1`.

### Authentication
- Email/password registration and login, with bcrypt password hashing.
- Google OAuth and Clerk SSO (LinkedIn, Apple) sign-in.
- Email verification via OTP and magic link.
- Access tokens issued as short-lived JWTs, kept in memory on the frontend
  (Redux), never persisted to localStorage.
- Refresh tokens stored as SHA-256 hashes in MongoDB, delivered to the
  client as an HttpOnly cookie scoped to `/auth/refresh`, with rotation on
  every refresh.
- Forgot-password flow via OTP, with its own rate limiting.

### Core domain
- Mentor and mentee profile management.
- Slot-based mentor availability (weekly schedule + specific-date overrides).
- Connect-request lifecycle: send → accept/reject → escrow → session →
  complete.
- Escrow-based payment system with per-role wallets and transaction history.
- Session scheduling, feedback, and ratings.
- Goals and milestones tracking.
- Shared and private notes per mentor-mentee connection.
- Real-time chat via Socket.IO, authenticated via JWT at the socket layer.
- PDF invoice generation.
- Web Push notifications (VAPID).
- Google Calendar integration — mentors can connect their calendar to sync
  availability and sessions.
- LeapBuddy AI assistant, proxied through Groq's LLaMA-based chat API.
- Admin panel: user management, report resolution, mentor verification
  workflow, platform commission settings, payment and engagement reports.

### Reliability & observability
- Winston logging with a BetterStack (Logtail) transport and Sentry error
  reporting.
- Centralized error handling (`AppError` + `handleError`) distinguishing
  operational errors (4xx, expected) from unexpected/programmer errors.
- Centralized response shape (`ok` / `created` / `fail` / `noContent`) used
  consistently across all controllers.
- Redis-backed rate limiting, global and per-route (login, registration,
  OTP, OAuth, forgot-password).

### Security
- Helmet middleware (CSP, HSTS, X-Frame-Options, etc.).
- MongoDB injection protection via `express-mongo-sanitize`.
- CORS restricted to an explicit allowlist from environment variables.
- Sensitive fields (passwords, tokens, OTPs, card data) redacted from all
  log output via a shared `sanitize()` utility.

---

## Migration notes

### Encrypting existing Google Calendar tokens
Any `Availability` document with a pre-existing plain-text
`googleCalendarToken` (written before the AES-256-GCM encryption change)
must be migrated — either via a one-off script that encrypts existing
values in place, or by having affected mentors disconnect and reconnect
their Google Calendar. Attempting to decrypt an un-migrated plain-text value
will throw, since it was never encrypted by the new `tokenCrypto.js` in the
first place.

### Required new environment variable
`CALENDAR_TOKEN_ENC_KEY` — a 64-character hex string (32 bytes), used to
encrypt/decrypt stored Google Calendar OAuth tokens. Generate with:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
The app will fail to start if this is missing or malformed once the
encryption change is deployed.