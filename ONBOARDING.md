# LeapMentor Backend — Member Onboarding Guide

> **Audience:** Backend engineers joining the LeapMentor project.
>
> This guide explains how the backend is organized, how requests flow through the application, the conventions followed throughout the codebase, and the development workflow expected when contributing. For a complete folder-by-folder breakdown, refer to **PROJECT_STRUCTURE.md**.

---

# Welcome

Welcome to the LeapMentor Backend project.

The backend follows a layered architecture with dependency injection, clear separation of responsibilities, and extensive unit and integration testing. Every feature follows the same development pattern, making the codebase predictable and easy to extend once the overall architecture is understood.

This document should be your first read before making changes to the project.

---

# Before You Start

Before writing any code:

1. Clone the repository.
2. Install dependencies.

```bash
npm install
```

3. Obtain the development `.env` file from your team.
4. Generate `CALENDAR_TOKEN_ENC_KEY` if required.

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

5. Seed the database (first setup only).

```bash
node scripts/seedAdmin.js
node scripts/seedPlatformCommission.js
```

6. Start the backend.

```bash
npm run dev
```

7. Verify:

* Server starts successfully
* MongoDB connects
* `/api-docs` loads
* No missing environment variable errors

---

# Understanding the Architecture

The backend follows a strict layered architecture.

```
HTTP Request
      │
      ▼
Route
      │
      ▼
Controller
      │
      ▼
Service
      │
      ▼
Repository
      │
      ▼
MongoDB
```

Each layer has a single responsibility.

---

## Route Layer

Routes define:

* endpoint URLs
* middleware
* validation
* authentication
* controller mapping
* Swagger documentation

Routes should never contain business logic.

---

## Controller Layer

Controllers are intentionally thin.

A controller should only:

* read the request
* call one service method
* return the response
* delegate error handling

Controllers should never:

* access MongoDB
* implement business rules
* perform calculations
* manipulate multiple repositories

---

## Service Layer

The service layer contains all business logic.

Examples include:

* booking sessions
* mentor verification
* payment workflows
* notifications
* report processing

Services coordinate multiple repositories and utility functions.

Every business rule belongs here.

---

## Repository Layer

Repositories are responsible for all database interaction.

Repositories contain:

* Mongoose queries
* aggregation pipelines
* populate chains
* projections

Repositories should not contain business logic.

---

## Models

Models define the MongoDB collections.

Every schema lives inside the `models/` directory and is accessed through repositories.

---

# Dependency Injection

The project uses dependency injection through:

```
config/container.js
```

Instead of importing repositories directly inside services, every dependency is injected.

Example flow:

```
Repository
      │
      ▼
Service
      │
      ▼
Controller
      │
      ▼
Routes
```

Benefits include:

* easier testing
* loose coupling
* easier maintenance
* predictable dependency graph

Whenever you add a new service dependency, register it inside `config/container.js`.

---

# Standard Request Flow

Every request follows the same lifecycle.

```
Incoming Request

↓

Route

↓

Authentication Middleware

↓

Validation Middleware

↓

Controller

↓

Service

↓

Repository

↓

MongoDB

↓

Mapper

↓

Response Helper

↓

Client
```

Understanding this flow will make debugging significantly easier.

---

# Response Standard

Controllers should never call:

```js
res.json()
```

Instead, always use the shared response helpers.

Examples:

```js
response.ok(res, data);
```

```js
response.created(res, data);
```

```js
response.noContent(res);
```

Error responses are handled through:

```
handleError()
```

This keeps every API response consistent.

---

# Error Handling

Business rule failures are represented using:

```
AppError
```

Example:

```js
throw new AppError(404, "Session not found");
```

Controllers should always wrap service calls inside:

```js
try {

}
catch (err) {
    return handleError(res, err, "feature");
}
```

Never manually build error responses inside controllers.

---

# Validation

Request validation is performed before controllers execute.

Validation uses:

* Joi
* `middleware/validate.js`
* `validators/*.validator.js`

Validators should only validate request shape.

Database queries should never occur inside validators.

---

# Authentication

The backend has two authentication systems.

## User Authentication

```
middleware/authenticate.js
```

Used for:

* mentors
* mentees

---

## Admin Authentication

```
middleware/adminAuth.js
```

Used only for admin routes.

Admin authentication is completely separate from user authentication.

---

# Utility Functions

Most shared functionality already exists inside `utils/`.

Before writing a helper, check whether an existing implementation already exists.

Common utilities include:

* response helpers
* retry wrappers
* transactions
* cache
* logging
* email helpers
* notification helpers
* token encryption
* wallet helpers

---

# Mapper Pattern

Responses should not expose raw Mongoose documents.

Every response should pass through the corresponding mapper inside:

```
utils/mappers/
```

This keeps API responses consistent while preventing accidental exposure of internal fields.

---

# Testing Strategy

The project uses multiple testing layers.

## Unit Tests

Unit tests mock dependencies.

Examples:

* controllers mock services
* services mock repositories

No database is involved.

---

## Integration Tests

Integration tests execute against an in-memory MongoDB instance.

They verify:

* repository behavior
* route wiring
* middleware execution

---

## Smoke Tests

Smoke tests execute the application end-to-end.

They verify that major routes respond correctly using the real application stack.

---

# Coding Guidelines

When contributing:

* Keep controllers thin.
* Keep repositories database-only.
* Keep business logic inside services.
* Use dependency injection.
* Reuse utility functions whenever possible.
* Reuse existing validators.
* Reuse response helpers.
* Throw `AppError` for business failures.
* Write tests for new functionality.
* Follow existing naming conventions.

Consistency with the existing codebase is more important than introducing a different pattern.

---

# Development Workflow

A typical feature implementation follows this order:

1. Create or update validator.
2. Create repository query.
3. Implement service logic.
4. Create controller method.
5. Register dependencies in `config/container.js`.
6. Add route.
7. Document endpoint using OpenAPI.
8. Add unit tests.
9. Add integration tests.
10. Verify using Swagger and the frontend.

---

# First-Day Checklist

Complete the following before starting development:

* Clone the repository.
* Install dependencies.
* Configure the environment file.
* Seed the initial data.
* Start the application.
* Browse `/api-docs`.
* Read `config/container.js`.
* Read `utils/response.js`.
* Read `utils/appError.js`.
* Read `PROJECT_STRUCTURE.md`.
* Run the full test suite.

---

# Common Things to Remember

* `app.js` is imported by tests.
* `server.js` starts the real server.
* Socket.IO is initialized only in `server.js`.
* Cron jobs run only from `server.js`.
* Every feature follows Route → Controller → Service → Repository.
* Every service is created through dependency injection.
* Controllers should remain as thin as possible.
* Every database operation belongs inside repositories.
* API responses should always use the shared response helpers.
* Business errors should always throw `AppError`.
* Always look for an existing utility before creating a new one.

---

# Where to Go Next

After reading this guide:

1. Read **PROJECT_STRUCTURE.md** to understand the folder organization.
2. Explore `config/container.js` to understand dependency wiring.
3. Follow one complete feature from route to repository.
4. Run the existing test suite.
5. Start implementing your first task using the existing architectural patterns.

Welcome to the LeapMentor Backend project!
