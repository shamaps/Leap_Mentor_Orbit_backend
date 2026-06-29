# LeapMentor Backend

LeapMentor mentorship platform — connecting mentees with industry expert mentors.


## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [API Routes](#api-routes)
- [Authentication Flows](#authentication-flows)
- [Real-time (Socket.IO)](#real-time-socketio)
- [Cron Jobs](#cron-jobs)
- [Pagination Strategy](#pagination-strategy)
- [Testing](#testing)
- [Deployment](#deployment)

---

## Overview

LeapMentor's backend handles:

- JWT-based auth with Google OAuth and Clerk SSO (LinkedIn, Apple)
- Mentor/mentee onboarding and profile management
- Slot-based availability and booking, with TTL-backed slot locking
- Real-time chat via Socket.IO
- Session lifecycle, feedback, goals, and shared/private notes
- Escrow-based payment flow with per-role wallets and earnings tracking
- Admin panel with user management, reports, mentor verification, and platform settings
- AI assistant ("LeapBuddy"), proxied through Groq's LLaMA-based chat API

--


## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js 18+ |
| Framework | Express 5 |
| Database | MongoDB + Mongoose 9 |
| Real-time | Socket.IO 4 |
| Auth | JWT + Google OAuth + Clerk |
| Email | Nodemailer (SMTP) |
| File Uploads | Cloudinary + Multer |
| Push Notifications | Web Push (VAPID) |
| PDF Generation | PDFKit |
| Scheduling | node-cron |
| Error monitoring | Sentry |
| Logging | Winston + BetterStack (Logtail) |
| Testing | Jest + Supertest + mongodb-memory-server |
| API docs | swagger-jsdoc, served at `/api-docs` |
| Deployment | Render |

---
## Dependencies

Install with `npm install`. Key production packages:

| Package | Version | Purpose |
|---|---|---|
| `express` | ^5.2.1 | HTTP framework |
| `mongoose` | ^9.2.1 | MongoDB ODM |
| `socket.io` | ^4.8.3 | Real-time WebSocket server |
| `jsonwebtoken` | ^9.0.3 | JWT signing and verification |
| `bcryptjs` | ^3.0.3 | Password hashing |
| `ioredis` | ^5.11.0 | Redis client — rate limiting + app-level cache |
| `cloudinary` | ^2.9.0 | File upload and storage |
| `multer` | ^2.2.0 | Multipart form data (file uploads) |
| `nodemailer` | ^9.0.1 | SMTP email sending |
| `pdfkit` | ^0.17.2 | Invoice PDF generation |
| `helmet` | ^8.2.0 | HTTP security headers |
| `express-rate-limit` | ^8.5.2 | API rate limiting |
| `express-mongo-sanitize` | — | MongoDB injection protection |
| `@sentry/node` | ^10.53.1 | Error monitoring |
| `@logtail/winston` | — | BetterStack log transport |
| `winston` | ^3.19.0 | Logging framework |
| `node-cron` | ^4.2.1 | Scheduled jobs |
| `swagger-jsdoc` / `swagger-ui-express` | — | OpenAPI spec generation + docs UI |

Dev dependencies: `jest`, `supertest`, `mongodb-memory-server`, `nodemon`, `eslint`, `prettier`


# Project Structure

The backend follows a layered architecture that separates routing, business logic, data access, and infrastructure concerns.

```text
.
├── app.js                        # Pure Express app (no DB connection, no server start) — imported by Jest
├── server.js                     # Entry point — connects DB, starts HTTP server, Socket.IO, and cron jobs
│
├── config/
│   ├── env.js                    # Centralized environment variable loading and validation
│   ├── database.js               # MongoDB connection configuration
│   ├── cloudinary.js             # Cloudinary configuration
│   └── container.js              # Dependency Injection wiring (Repository → Service → Controller)
│
├── controllers/                  # Route handler logic (one file per feature)
│   └── admin/                    # Admin-specific controllers
│
├── models/                       # Mongoose schemas
│
├── routes/
│   └── admin/                    # Admin sub-routes mounted under /admin
│
├── middleware/
│   ├── authenticate.js           # JWT authentication middleware for users
│   ├── adminAuth.js              # JWT authentication middleware for admins
│   ├── validate.js               # Joi validation middleware
│   ├── noteAccess.js             # Note/session ownership validation
│   └── upload.middleware.js      # Multer + Cloudinary upload middleware
│
├── socket/
│   ├── socketAuth.js             # Socket.IO authentication middleware
│   └── socketHandler.js          # Real-time Socket.IO event handlers
│
├── services/                     # Business logic layer
│
├── repositories/                 # Database query abstraction layer
│
├── validators/                   # Joi validation schemas (one per feature)
│
├── utils/                        # Shared helpers (tokens, emails, invoices, cache, retry, etc.)
│
├── cron/                         # Scheduled background jobs
│
├── scripts/                      # One-time seed and maintenance scripts
│
└── tests/                        # Unit, integration, and other test suites
```

## Folder Responsibilities

| Folder            | Responsibility                                                                                     |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **config/**       | Application configuration, environment variables, dependency injection, and external service setup |
| **controllers/**  | Accept requests, invoke services, and return API responses                                         |
| **services/**     | Contains all business logic                                                                        |
| **repositories/** | Performs all MongoDB/Mongoose operations                                                           |
| **models/**       | Mongoose schema definitions                                                                        |
| **routes/**       | Express route definitions and API endpoints                                                        |
| **middleware/**   | Authentication, validation, authorization, and upload middleware                                   |
| **validators/**   | Joi request validation schemas                                                                     |
| **socket/**       | Socket.IO authentication and real-time event handling                                              |
| **utils/**        | Shared utility functions and reusable helpers                                                      |
| **cron/**         | Scheduled background jobs                                                                          |
| **scripts/**      | Manual scripts for seeding and maintenance                                                         |
| **tests/**        | Unit and integration tests                                                                         |



## Getting Started

### Prerequisites

- Node.js v20+
- MongoDB (Atlas URI or local)
- Redis (rate limiting and the admin-settings cache will log connection errors and
  degrade gracefully without it, but it's required for production behavior)
- A `.env` file (see [Environment Variables](#environment-variables))

### Install & Run

```bash
# Install dependencies
npm install

# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

### Seed Scripts

Run after first setup:

```bash
node scripts/seedAdmin.js
node scripts/seedPlatformCommission.js
```

---

## Environment Variables

These are validated by `config/env.js`. Variables marked **required** throw
`Missing required env var: X` at startup if absent.

```env
# Server
PORT=5000                          # optional, default 5000
NODE_ENV=development               # optional, default development

# MongoDB
MONGO_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/leapmentor   # required

# JWT
JWT_SECRET=your_jwt_secret_here    # required
JWT_ACCESS_EXPIRES_IN=15m          # optional, default 15m
JWT_REFRESH_EXPIRES_IN_DAYS=7      # optional, default 7
JWT_ADMIN_EXPIRES_IN=7d            # optional, default 7d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id        # required
GOOGLE_CLIENT_SECRET=your_google_client_secret # required
GOOGLE_REDIRECT_URI=                           # optional

# Clerk SSO
CLERK_SECRET_KEY=your_clerk_secret_key   # required

# Frontend / CORS
APP_BASE_URL=http://localhost:5173       # required
CLIENT_URL=http://localhost:5173         # optional
CORS_ORIGINS=                            # optional, comma-separated allowlist

# SMTP (Email) — all optional, but email sending will fail without them
SMTP_HOST=smtp.yourprovider.com
SMTP_PORT=587
SMTP_USER=your@email.com
SMTP_PASS=yourpassword
SMTP_SECURE=false
FROM_EMAIL=noreply@leapmentor.com

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name      # required
CLOUDINARY_API_KEY=your_api_key            # required
CLOUDINARY_API_SECRET=your_api_secret      # required

# Redis
REDIS_HOST=127.0.0.1     # optional, default 127.0.0.1
REDIS_PORT=6379          # optional, default 6379
REDIS_PASSWORD=          # optional
REDIS_TLS=false          # optional
REDIS_URL=               # optional — overrides host/port/password if set

# Web Push (VAPID) — optional; push notifications are non-functional regardless,
# see Known Issues
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_EMAIL=
VAPID_MAILTO=

# Observability — all optional
SENTRY_DSN=
LOGTAIL_TOKEN=
GROQ_API_KEY=

# Google Calendar token encryption
CALENDAR_TOKEN_ENC_KEY=   # see note below — effectively required if google-calendar is used

# Misc
PLATFORM_TIMEZONE=Asia/Kolkata   # optional, default Asia/Kolkata
COOKIE_DOMAIN=                   # optional
```

> **`CALENDAR_TOKEN_ENC_KEY` note:** `config/env.js` itself treats this as optional
> (`process.env.CALENDAR_TOKEN_ENC_KEY` with no default). However, `utils/tokenCrypto.js`
> validates it at module-load time and throws if it's missing or not a 64-character hex
> string — and that module is loaded eagerly through `config/container.js` as soon as the
> app boots. In practice, the app *will* fail to start without a valid key, but the
> enforcement point is `tokenCrypto.js`, not `env.js`. Generate one with:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## API Routes

All routes are mounted under `/api/v1` (see `app.js`).
Routes marked **User** require `Authorization: Bearer <token>` or an `accessToken`
HttpOnly cookie, validated by `middleware/authenticate.js`. Routes marked **Admin**
require a *separate* `adminAccessToken` cookie, validated by `middleware/adminAuth.js`
against the `AdminUser` model — this is not the same auth system as regular users.

### Auth — `/auth`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | No | Register with email + password (Joi-validated) |
| POST | `/auth/login` | No | Login, returns JWT (Joi-validated) |
| POST | `/auth/google` | No | Google OAuth login/register |
| POST | `/auth/clerk-sso` | No | Clerk SSO (LinkedIn, Apple) |
| POST | `/auth/refresh` | No (cookie) | Rotate refresh token, issue new access token |
| POST | `/auth/logout` | No | Clear refresh token cookie |
| PATCH | `/auth/password` | User | Change password — **not currently Joi-validated**, see Known Issues |
| POST | `/auth/password-reset` | No | Send password-reset OTP |
| POST | `/auth/password-reset/verification` | No | Verify reset OTP |
| POST | `/auth/password-reset/confirmation` | No | Confirm new password with OTP |

### Verification — `/verification`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/verification/send` | No | Send OTP + magic link |
| POST | `/verification/resend` | No | Resend verification email |
| POST | `/verification/verify-otp` | No | Verify OTP code |
| GET | `/verification/verify/:token` | No | Verify via magic link (`?email=` query param) |

### Users — `/users`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/users/me` | User | Get logged-in user info |

### Mentor Profile — `/mentor-profile`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/mentor-profile` | User (mentor) | Create profile (onboarding) |
| GET | `/mentor-profile/me` | User (mentor) | Get own profile |
| PATCH | `/mentor-profile/me` | User (mentor) | Update own profile |
| GET | `/mentor-profile/:id` | No | Get public profile by userId |

### Mentee Profile — `/mentee-profile`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/mentee-profile` | User (mentee) | Create profile (onboarding) |
| GET | `/mentee-profile/me` | User (mentee) | Get own profile |
| PATCH | `/mentee-profile/me` | User (mentee) | Update own profile |
| GET | `/mentee-profile/:id` | No | Get public profile |

### Mentor Search — `/mentors`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/mentors/search` | User (mentee) | Search mentors, query-param validated |

### Availability — `/availability`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/availability/me` | User (mentor) | Get own availability |
| POST | `/availability` | User (mentor) | Create availability |
| PATCH | `/availability/me` | User (mentor) | Update availability |
| DELETE | `/availability/me` | User (mentor) | Clear availability |
| GET | `/availability/:mentorId/slots` | User (mentee) | Get bookable slots |
| GET | `/availability/:mentorId` | No | Get mentor availability (public) |

### Connect Requests — `/connect-requests`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/connect-requests` | User | Send a connect request |
| GET | `/connect-requests/my-requests` | User | Requests sent by the logged-in mentee |
| GET | `/connect-requests/incoming` | User | Requests received by the logged-in mentor |
| GET | `/connect-requests/ongoing` | User | Active/completed connects for either role |
| GET | `/connect-requests/:id/detail` | User | Single request, detailed view |
| GET | `/connect-requests/:id/similar-mentors` | User (mentor) | Suggested mentors for a referral |
| PATCH | `/connect-requests/:id` | User | Accept/reject a request |
| PATCH | `/connect-requests/:id/refer` | User (mentor) | Refer the request to another mentor |
| DELETE | `/connect-requests/:id` | User | Cancel a request |

### Sessions — `/sessions`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/sessions/:connectRequestId/slots` | User | Get session slots |
| GET | `/sessions/:connectRequestId/mentor-availability` | User | Mentor availability for this session |
| POST | `/sessions/:connectRequestId/slots` | User | Add a slot |
| PATCH | `/sessions/:connectRequestId/slots/:slotIndex/status` | User | Update slot status (e.g. mark complete) |
| PATCH | `/sessions/:connectRequestId/slots/:slotIndex/meeting-link` | User | Set the meeting link for a slot |

### Escrow — `/escrow`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/escrow/pay` | User (mentee) | Lock funds into escrow |
| POST | `/escrow/pay-additional` | User (mentee) | Pay for additional slots |
| PATCH | `/escrow/:requestId` | User | Release/refund escrow |
| GET | `/escrow/status/:requestId` | User | Escrow status for a request |
| GET | `/escrow/commission-rate` | User | Current platform commission rate |
| GET | `/escrow/wallet` | User | Logged-in user's wallet |

### Earnings — `/mentor/earnings`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/mentor/earnings` | User (mentor) | Earnings summary |
| GET | `/mentor/earnings/chart` | User (mentor) | Earnings chart data |
| GET | `/mentor/earnings/payouts` | User (mentor) | Payout history |
| POST | `/mentor/earnings/withdraw` | User (mentor) | Withdraw earnings |

### Goals — `/goals`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/goals` | User | Create a goal for a connect request |
| GET | `/goals/:connectRequestId` | User | Get the goal for a session |
| PATCH | `/goals/:goalId` | User | Update a goal |
| POST | `/goals/:goalId/milestones` | User | Add a milestone |
| PATCH | `/goals/milestones/:milestoneId` | User | Update a milestone |
| DELETE | `/goals/milestones/:milestoneId` | User | Delete a milestone |

### Notes — `/notes` and `/private-notes`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/notes` | User | Create a shared note |
| GET | `/notes/:connectRequestId` | User | Get shared notes for a session |
| GET | `/notes/:connectRequestId/private` | User | Get private notes for a session |
| DELETE | `/notes/:id` | User | Delete a note |
| POST | `/private-notes` | User | Create a private note |
| GET | `/private-notes/:connectRequestId` | User | Get own private notes for a session |
| PATCH | `/private-notes/:id` | User | Update a private note |
| DELETE | `/private-notes/:id` | User | Delete a private note |

### Messages — `/messages`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/messages/:connectRequestId` | User | Chat history (cursor-paginated) |
| GET | `/messages/:connectRequestId/unread` | User | Unread message count |

### Notifications — `/notifications`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/notifications` | User | Get all notifications |
| PATCH | `/notifications/:id/read` | User | Mark one as read |
| PATCH | `/notifications/mark-all-read` | User | Mark all as read |
| DELETE | `/notifications/:id` | User | Delete one notification |
| DELETE | `/notifications/clear-all` | User | Delete all notifications |

### Push — `/push`

> **Built but not reachable — see [Known Issues](#known-issues).** `routes/push.routes.js`
> defines the endpoints below but is never `require`d/mounted in `app.js`. All three
> currently 404.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/push/vapid-public-key` | No | Get the VAPID public key |
| POST | `/push/subscribe` | User | Save a push subscription |
| DELETE | `/push/unsubscribe` | User | Remove a push subscription |

### Feedback — `/feedback`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/feedback` | User | Submit session feedback |
| GET | `/feedback/:connectRequestId` | User | Get feedback for a session |

### Reports — `/reports`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/reports` | User | Submit a report (optional screenshot upload) |
| GET | `/reports/my/:connectRequestId` | User | Get own report for a connect request |

### Support — `/support`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/support/messages` | No | Submit a support message (public form) |
| GET | `/support/messages` | Admin | List support messages |
| PATCH | `/support/messages/:id/resolve` | Admin | Resolve a support message |

### LeapBuddy AI — `/ai`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/ai/chat` | User | Proxy a chat message to Groq's LLaMA-based API |

### Google Calendar — `/google-calendar`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/google-calendar/auth-url` | User | Get the OAuth consent URL |
| GET | `/google-calendar/callback` | No | OAuth redirect callback |
| GET | `/google-calendar/status` | User | Connection status |
| GET | `/google-calendar/busy` | User | Busy time blocks |
| GET | `/google-calendar/events` | User | Calendar events |
| DELETE | `/google-calendar/connection` | User | Disconnect calendar |

### Leap Requests (mentor applications) — `/leap-requests`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/leap-requests` | User (mentee) | Submit a leap (mentor-track) request |
| GET | `/leap-requests/my-request` | User (mentee) | Get own leap request |
| GET | `/leap-requests` | Admin | List all leap requests |
| PATCH | `/leap-requests/:id/approve` | Admin | Approve a leap request |
| PATCH | `/leap-requests/:id/reject` | Admin | Reject a leap request |

### Slot Locks — `/slot-locks`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/slot-locks/lock` | User (mentee) | TTL-lock a slot during checkout |
| DELETE | `/slot-locks/lock` | User (mentee) | Release one lock |
| DELETE | `/slot-locks/locks` | User (mentee) | Release all of the mentee's locks |
| GET | `/slot-locks/:mentorId` | User | Get active locks for a mentor |

### Upload — `/upload`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/upload/profile-picture` | User | Upload profile picture to Cloudinary |
| POST | `/upload/verification-documents` | User | Upload mentor verification documents |

### Invoices — `/invoices`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/invoices/:connectRequestId` | User | Download session invoice PDF |

### Images — `/images` (mounted directly on `app`, not under the `/api/v1` router — actual path is `/api/v1/images`)

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/images/profile/:userId` | User | Fetch a profile image |

### Admin — `/admin`

All admin endpoints require the `adminAccessToken` cookie (see auth note above), except login.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/admin/auth/login` | No | Admin login |
| POST | `/admin/auth/logout` | Admin | Admin logout |
| GET | `/admin/auth/me` | Admin | Current admin profile |
| GET | `/admin/stats` | Admin | Dashboard stats |
| GET | `/admin/user-growth` | Admin | User growth chart data |
| GET | `/admin/stats/mentor-industries` | Admin | Mentor industry breakdown |
| GET | `/admin/users` | Admin | List users (query-validated, paginated) |
| GET | `/admin/users/:userId` | Admin | User detail |
| DELETE | `/admin/users/:userId` | Admin | Delete a user |
| PATCH | `/admin/users/:userId/block` | Admin | Block a user |
| PATCH | `/admin/users/:userId/unblock` | Admin | Unblock a user |
| GET | `/admin/engagements` | Admin | List engagements |
| GET | `/admin/engagements/stats` | Admin | Engagement stats |
| GET | `/admin/leap-requests` | Admin | List leap (mentor application) requests |
| GET | `/admin/leap-requests/pending-count` | Admin | Pending leap-request count |
| PATCH | `/admin/leap-requests/:id/approve` | Admin | Approve |
| PATCH | `/admin/leap-requests/:id/reject` | Admin | Reject |
| GET | `/admin/settings/overview` | Admin | Platform settings overview |
| GET | `/admin/settings/commission` | Admin | Current commission rate |
| PATCH | `/admin/settings/commission` | Admin | Update commission rate |
| PATCH | `/admin/settings/change-password` | Admin | Change own admin password |
| POST | `/admin/settings/admins` | Admin | Add a new admin user |
| GET | `/admin/payments/stats` | Admin | Payment stats |
| GET | `/admin/payments/chart` | Admin | Revenue chart |
| GET | `/admin/payments/transactions` | Admin | Transaction list |
| GET | `/admin/reports/stats` | Admin | Report stats |
| GET | `/admin/reports/` | Admin | List reports |
| PATCH | `/admin/reports/:id` | Admin | Update report status |
| POST | `/admin/reports/:id/refund` | Admin | Process a refund for a reported session |
| DELETE | `/admin/reports/:id/session` | Admin | Delete the connect request behind a report |
| GET | `/admin/mentor-verifications/` | Admin | List mentor verification requests |
| GET | `/admin/mentor-verifications/:mentorProfileId` | Admin | Verification detail |
| PATCH | `/admin/mentor-verifications/:mentorProfileId/verify` | Admin | Verify a mentor |
| PATCH | `/admin/mentor-verifications/:mentorProfileId/revoke` | Admin | Revoke verification |

Full interactive docs (generated from inline `@openapi` JSDoc annotations across all route
files) are served at `/api-docs` once the server is running.

---

## Authentication Flows

### Email / Password
1. `POST /auth/register` → Joi-validated, creates user, sends OTP + magic link.
2. `POST /verification/verify-otp` (or `GET /verification/verify/:token`) → `isEmailVerified = true`.
3. `POST /auth/login` → Joi-validated, returns a short-lived access token (response body)
   and sets an HttpOnly `refreshToken` cookie.
4. Access token is sent as `Authorization: Bearer <token>` or read from an `accessToken`
   cookie by `middleware/authenticate.js`.
5. `POST /auth/refresh` rotates the refresh token and issues a new access token.

### Google OAuth
1. Frontend renders Google's Sign-In button (GSI) and gets back a signed `credential`.
2. `POST /auth/google` verifies it server-side with `google-auth-library`, creates/finds
   the user, returns a JWT.

### Clerk SSO (LinkedIn / Apple)
1. Frontend triggers Clerk's `authenticateWithRedirect`.
2. `POST /auth/clerk-sso` exchanges the Clerk session for an internal JWT.

### Admin
Admins authenticate separately via `POST /admin/auth/login` against the `AdminUser`
model, receiving a distinct `adminAccessToken` cookie carrying `{ role: "admin" }` in
the JWT payload — `middleware/adminAuth.js` rejects any token without that claim.

---

## Real-time (Socket.IO)

Socket.IO runs on the same HTTP server as Express (wired in `server.js`, not `app.js`).
Auth is handled by `socket/socketAuth.js`, which validates the JWT passed in
`socket.handshake.auth.token`.

| Event | Direction | Description |
|-------|-----------|--------------|
| `join_room` | Client → Server | Join a chat room by `connectRequestId` |
| `send_message` | Client → Server | Send a chat message |
| `receive_message` | Server → Client | Receive a new message |
| `notification` | Server → Client | Real-time notification push |
| `disconnect` | Client → Server | Auto-cleanup on disconnect |

---

## Cron Jobs

| File | Schedule | Description |
|------|----------|--------------|
| `cron/cleanupAvailability.js` | Nightly (midnight) | Removes past specific-date overrides from mentor availability |
| `cron/sessionReminders.js` | Every hour | Sends push + email reminders for upcoming sessions |

Both jobs wrap their entire body in `try/catch` with logging — there's no request
context to catch an unhandled rejection for them, so this is the only safety net
besides the process-level `unhandledRejection` handler in `server.js`.

---

## Pagination Strategy

Two approaches, chosen deliberately based on dataset characteristics:

### 1. Skip/Limit (`cursor.skip()` + `cursor.limit()`)

**Used for:** Admin list views — Users, Engagements, Transactions, Reports, Mentor
Verifications, Leap Requests.

**Why:** These datasets are bounded, moderate in size, and the UI needs page-number
navigation. The `skip()` cost is acceptable here because page sizes are small (10–20
records), admin users rarely paginate deep, and collections are queried with an
indexed filter first.

**Where:** `admin.repository.js`, `adminPayments.repository.js`,
`adminReports.repository.js`, `adminVerification.repository.js`,
`leapRequest.repository.js`, `support.repository.js`, `report.repository.js`,
`earnings.repository.js`, `mentorSearch.repository.js`.

### 2. Cursor-Based (`_id` + `$lt`)

**Used for:** Chat messages (`repositories/message.repository.js`), via
`filter._id = { $lt: beforeId }`.

**Why:** Message history is append-heavy, chronologically ordered, and can grow
unbounded per conversation — `skip()` cost would grow linearly with offset. Chat UIs
load "previous messages" relative to the last-seen message, not by page number, and
`_id` is already a monotonically-increasing, indexed cursor with no extra fields needed.

### Decision Rule

| Dataset trait | Approach |
|---|---|
| Bounded size, needs page numbers, admin/back-office UI | Skip/limit |
| Unbounded growth, chronological, infinite-scroll UI | Cursor (`_id`-based) |

**Note:** Transaction and report lists currently use skip/limit. As they grow, they're
candidates to migrate to cursor-based pagination using `createdAt`/`_id`, following the
pattern already used in `message.repository.js`.

### Why not MapReduce

MongoDB deprecated `mapReduce` in favor of the aggregation pipeline from v5.0 onward.
This project uses the aggregation pipeline (`$group`, `$sum`, `$lookup`, `$facet`,
`$project`) exclusively for analytics-style queries (mentor industry breakdowns, user
growth charts, search ranking) — see `repositories/mentorSearch.repository.js`,
`repositories/userSearch.repository.js`, and `repositories/admin.repository.js`.
Aggregation pipelines are index-aware and query-planner-optimized; `mapReduce` runs
interpreted JS server-side and doesn't benefit from either.

---

## Testing

```bash
npm test                  # full suite, jest --maxWorkers=50%
npx jest --coverage       # full suite with a coverage report
```

Test suites live under `__tests__/`:

- `__tests__/unit/controllers/`, `__tests__/unit/services/` — dependency-mocked unit
  tests, one file per controller/service.
- `__tests__/integration/routes/`, `__tests__/integration/repository/` — exercise real
  Express routers / Mongoose models against an in-memory MongoDB
  (`mongodb-memory-server`), with the controller layer mocked for route tests.
- `__tests__/fixtures/createTestData.js` — shared factories built on the real Mongoose
  models (not hand-rolled mini-schemas), so integration tests can't drift from
  production validation rules.


---

## Deployment

Deployed on **Render**.

1. Connect the GitHub repo to Render.
2. Set all `.env` variables in the Render dashboard → Environment.
3. Start Command: `node server.js`.
4. After deploy, add the Render backend URL to:
   - Google Cloud Console → Authorized redirect URIs (for OAuth + Calendar)
   - Google Cloud Console → Authorized JavaScript origins (frontend URL)

---

## Debug Tools

| Tool | Purpose |
|------|---------|
| [REST Client](https://marketplace.visualstudio.com/items?itemName=humao.rest-client) | VS Code extension — run HTTP requests from `.http` files |
| [MongoDB for VS Code](https://marketplace.visualstudio.com/items?itemName=mongodb.mongodb-vscode) | Browse collections / run queries without leaving the editor |
| Sentry Dashboard | Runtime error monitoring, configured via `SENTRY_DSN` |
| Winston + BetterStack | Structured logs, configured via `LOGTAIL_TOKEN` |
| `npm run dev` (nodemon) | Auto-restart on file save; add `--inspect` for Chrome DevTools |

---
