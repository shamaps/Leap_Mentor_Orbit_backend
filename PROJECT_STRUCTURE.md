# LeapMentor Backend — Project Structure

---

## Top-level Layout

```text
.
├── app.js                    # Pure Express app — middleware + routes, no DB connect, no server start
├── server.js                 # Entry point — connects DB, starts HTTP server, Socket.IO, cron jobs
├── package.json
├── jest.config.js            # Jest configuration (bail: 1, testTimeout, etc.)
├── jest.setup.env.js         # Test-only env vars (JWT_SECRET, etc.) loaded before the suite runs
├── eslint.config.js
├── sonar-project.properties  # SonarQube scan config
├── migrate-mongo-config.js   # migrate-mongo CLI config (points at migrations/)
├── swagger.js                # Builds the OpenAPI spec from swagger/ + inline @openapi JSDoc
├── swagger-output.json       # Generated OpenAPI 3.0 spec (do not hand-edit — regenerate via swagger.js)
├── Dockerfile
├── README.md
├── CHANGELOG.md
├── DATA_MODEL.md             # Entity-relationship diagrams (Mermaid) for the Mongoose models
│
├── config/                   # 5 files   — env loading, DB/Cloudinary setup, DI container, shared constants
├── controllers/              # 38 files  — route handler logic (req/res), one file per feature/operation
├── routes/                   # 33 files  — Express router definitions + inline @openapi docs
├── services/                 # 41 files  — business logic, framework-agnostic, injected via container.js
├── repositories/             # 37 files  — all Mongoose queries; the only layer that touches models directly
├── models/                   # 23 files  — Mongoose schemas, one per collection
├── middleware/               # 6 files   — auth guards, validation, upload, note-access checks
├── validators/               # 15 files  — Joi schemas, one per feature, used by middleware/validate.js
├── utils/                    # 56 files  — helpers; see breakdown below, includes mappers/ and emails/ subfolders
├── socket/                   # 2 files   — Socket.IO auth + event handlers
├── cron/                     # 2 files   — scheduled jobs
├── scripts/                  # 4 files   — one-off / manual run scripts (seeding, migration helpers)
├── migrations/               # 1 file    — migrate-mongo-managed schema migrations
├── swagger/                  # 1 file    — shared OpenAPI component schemas ($ref target)
└── __tests__/                # 155 files
```

---

## Why Some Layers Are Split the Way They Are

### `controllers/` is one file per operation, not one per route file

A route file like `routes/auth.routes.js` pulls handlers from seven different controller files:

* `login.controller.js`
* `register.controller.js`
* `forgotPassword.controller.js`
* `changePassword.controller.js`
* `refreshToken.controller.js`
* `googleAuth.controller.js`
* `verification.controller.js`

Rather than creating one large authentication controller, each authentication flow is isolated into its own controller file. This keeps each controller focused on a single responsibility, makes unit testing straightforward, and prevents unrelated authentication logic from growing into a single large module.

## `controllers/admin/` Exists, but `routes/admin/` Is the Only Other Folder of Its Kind

Only two layers have a nested admin-specific subfolder:

* `controllers/admin/`
* `routes/admin/`

The latter contains a single `index.js` that re-mounts five separate admin route files under `/admin/*` (see `routes/admin/index.js`).

Services, repositories, and models do **not** have an `admin/` subfolder. Instead, admin-specific business logic lives alongside the rest of the codebase in flat files such as:

* `services/adminSettings.service.js`
* `repositories/adminPayments.repository.js`

The distinction is made entirely by filename prefix rather than folder structure.

---

## `utils/` Is the Largest Folder and Has Two Real Sub-clusters

Most of `utils/`'s 56 files are flat, single-purpose helpers (`tokenCrypto.js`, `withRetry.js`, `cache.js`, `sanitize.js`, etc.), but two groups are deliberately nested.

### `utils/mappers/` (15 files)

One mapper per domain entity (`user.mapper.js`, `connectRequest.mapper.js`, `escrow.mapper.js`, etc.), each converting a raw Mongoose document into the exact shape the frontend reads.

Several mapper files carry a header comment listing the specific frontend fields they were derived from (for example, `connectRequest.mapper.js` lists the exact fields confirmed during a frontend component audit). These comments effectively form the backend/frontend contract for that entity, often more precisely than the OpenAPI schema.

### `utils/emails/` (5 files)

One file per email-template category:

* `adminEmails.js`
* `connectRequestEmails.js`
* `paymentEmails.js`
* `sessionEmails.js`

plus an `index.js` that re-exports them as a single mailer-facing interface.

---

## `repositories/` Is the Only Layer Allowed to Import a Mongoose Model Directly

This is a convention rather than an enforced lint rule, but it is followed consistently across all 37 repository files.

Services never `require()` anything from `models/` directly. Every database read or write flows through the corresponding repository function.

This separation is what enables the unit-testing strategy: services are tested by mocking repository functions instead of mocking Mongoose itself.

---

## `__tests__/` Mirrors the Source Tree, Plus Three Test-only Folders

```text
__tests__/
├── unit/
│   ├── controllers/      # 38 files — one per controller, dependencies mocked via factory-pattern DI
│   ├── services/         # 38 files — one per service, repository functions mocked
│   └── mocks/            # 4 files — shared fakes:
│                          # cloudinary.mock.js
│                          # mailer.mock.js
│                          # pushNotification.mock.js
│                          # logger.mock.js
├── integration/
│   ├── routes/           # 34 files — real Express router + Supertest against
│   │                     # mongodb-memory-server, with the controller layer mocked
│   └── repository/       # 37 files — real Mongoose models +
│                          # mongodb-memory-server, no mocking
├── fixtures/
│   └── createTestData.js # Shared factories built on the real models
└── utils/
    └── db.js             # mongodb-memory-server lifecycle helper
```

The `unit/` vs `integration/` split is strict:

* **unit/** never touches a real or in-memory database (repositories are mocked).
* **integration/** always uses `mongodb-memory-server`, never a real MongoDB instance.

---

## `migrations/` vs `scripts/` — Two Different Purposes

### `migrations/`

Managed by `migrate-mongo` (configured via `migrate-mongo-config.js`).

Migration files are:

* versioned
* timestamped
* executed once per environment
* tracked in order

Example:

```text
20260622094301-mark-existing-mentors-as-verified.js
```

### `scripts/`

Executed manually using:

```bash
node scripts/<name>.js
```

They are **not** tracked by any migration runner.

Examples include:

* `seedAdmin.js`
* `seedPlatformCommission.js`
* `checkIndexRam.js`
* `migrateExistingMentorsToVerified.js`

One script deserves attention.

`migrateExistingMentorsToVerified.js` targets the same query as the tracked migration:

```js
verificationStatus: { $exists: false }
```

but assigns the opposite value (`"verified"` rather than `"unverified"`), while also updating additional fields such as:

* `phoneNumber`
* `resumeDocument`
* `workExperienceDocuments`

Because there is no record of which script or migration ran in a given environment—or in what order—the current verification status of legacy mentor profiles cannot be determined from the code alone. This should be resolved by confirming which process was actually executed and removing or correcting the obsolete one.

---

## `swagger/` (Folder) vs `swagger.js` vs `swagger-output.json`

Three different things share the name **swagger**.

### `swagger/_shared.js`

Contains reusable OpenAPI component schemas (standard success/error envelopes, etc.) referenced through `$ref` from inline `@openapi` annotations.

### `swagger.js`

The build script.

Runs `swagger-jsdoc` across all annotated route files and generates the combined OpenAPI specification.

### `swagger-output.json`

The generated OpenAPI specification.

This is a build artifact and should not be edited manually. It is served by `app.js` at `/api-docs` using `swagger-ui-express`.

---

# Quick Reference — Where Does X Live?

| If you're looking for...                          | It's in...                                                                 |
| ------------------------------------------------- | -------------------------------------------------------------------------- |
| An Express route definition                       | `routes/*.routes.js` (or `routes/admin/` for admin sub-routes)             |
| Request validation rules                          | `validators/*.validator.js` (Joi schemas)                                  |
| Auth/role-check logic                             | `middleware/authenticate.js` (users), `middleware/adminAuth.js` (admins)   |
| Business logic for a feature                      | `services/<feature>.service.js`                                            |
| The actual MongoDB query                          | `repositories/<feature>.repository.js`                                     |
| A Mongoose schema                                 | `models/<Entity>.js`                                                       |
| How a DB document becomes an API response         | `utils/mappers/<entity>.mapper.js`                                         |
| An email template                                 | `utils/emails/<category>Emails.js`                                         |
| Dependency wiring (which service gets which repo) | `config/container.js`                                                      |
| Shared constants (enums, statuses)                | `config/constants.js`                                                      |
| A scheduled job                                   | `cron/*.js`                                                                |
| A one-time setup/backfill script                  | `scripts/*.js`                                                             |
| A tracked schema migration                        | `migrations/*.js`                                                          |
| A test for any of the above                       | `__tests__/unit/` (mocked) or `__tests__/integration/` (real in-memory DB) |
| Shared test data factories                        | `__tests__/fixtures/createTestData.js`                                     |
