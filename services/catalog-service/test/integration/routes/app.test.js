/**
 * @fileoverview Wiring tests for the Catalog Express app: route mounting, trace ids, security
 * middleware, body sanitising, the Google OAuth callback headers and error handling. Route
 * modules are replaced by stubs, so only app.js itself is under test.
 */

const request = require("supertest");

let mockLimiterHits = 0;

// Every route module becomes a tiny router that identifies itself.
const mockMakeRouter = (name) => {
    const express = require("express");
    const AppError = require("@leapmentor/shared/utils/appError");
    const router = express.Router();
    router.get("/probe", (req, res) => res.json({ mounted: name, traceId: req.traceId }));
    router.get("/callback", (req, res) => res.json({ mounted: name }));
    router.post("/echo", (req, res) => res.json({ body: req.body }));
    router.get("/boom", (req, res, next) => next(new AppError(409, "conflict from route")));
    router.get("/crash", (req, res, next) => next(new Error("kaboom")));
    return router;
};

jest.mock("../../../src/routes/ai.routes", () => mockMakeRouter("ai"));
jest.mock("../../../src/routes/upload.routes", () => mockMakeRouter("upload"));
jest.mock("../../../src/routes/mentorProfile.routes", () => mockMakeRouter("mentorProfile"));
jest.mock("../../../src/routes/menteeProfile.routes", () => mockMakeRouter("menteeProfile"));
jest.mock("../../../src/routes/mentorSearch.routes", () => mockMakeRouter("mentorSearch"));
jest.mock("../../../src/routes/availability.routes", () => mockMakeRouter("availability"));
jest.mock("../../../src/routes/slotLock.routes", () => mockMakeRouter("slotLocks"));
jest.mock("../../../src/routes/googleCalendar.routes", () => mockMakeRouter("googleCalendar"));
jest.mock("../../../src/routes/image.routes", () => mockMakeRouter("images"));
jest.mock("../../../src/routes/admin", () => mockMakeRouter("admin"));
jest.mock("../../../src/routes/internalUsers.routes", () => mockMakeRouter("internalUsers"));
jest.mock("../../../src/routes/internal.routes", () => mockMakeRouter("internal"));

jest.mock("@leapmentor/shared/middleware/rateLimiter", () => ({
    globalLimiter: (req, res, next) => { mockLimiterHits += 1; next(); },
}));

jest.mock("@leapmentor/shared/utils/health", () => ({
    createHealthRouter: ({ service }) => {
        const router = require("express").Router();
        router.get("/live", (req, res) => res.json({ service }));
        return router;
    },
}));

const app = require("../../../src/app");

beforeEach(() => { mockLimiterHits = 0; });

describe("Catalog app wiring (Integration)", () => {
    describe("route mounting", () => {
        it.each([
            ["/api/v1/ai/probe", "ai"],
            ["/api/v1/upload/probe", "upload"],
            ["/api/v1/mentor-profile/probe", "mentorProfile"],
            ["/api/v1/mentee-profile/probe", "menteeProfile"],
            ["/api/v1/mentors/probe", "mentorSearch"],
            ["/api/v1/availability/probe", "availability"],
            ["/api/v1/slot-locks/probe", "slotLocks"],
            ["/api/v1/google-calendar/probe", "googleCalendar"],
            ["/api/v1/images/probe", "images"],
            ["/api/v1/admin/probe", "admin"],
            ["/internal/probe", "internal"],
        ])("should serve %s from the %s router", async (path, name) => {
            const res = await request(app).get(path);

            expect(res.status).toBe(200);
            expect(res.body.mounted).toBe(name);
        });

        it("should give /internal/users to the lifecycle router before the general internal router", async () => {
            const res = await request(app).get("/internal/users/probe");

            expect(res.body.mounted).toBe("internalUsers");
        });

        it("should answer health probes", async () => {
            const res = await request(app).get("/health/live");

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ service: "catalog" });
        });

        it("should not expose the public routes outside /api/v1", async () => {
            expect((await request(app).get("/mentors/probe")).status).toBe(404);
            expect((await request(app).get("/availability/probe")).status).toBe(404);
        });

        it("should return a JSON 404 for unknown routes", async () => {
            const res = await request(app).get("/nope");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ success: false, message: "Route GET /nope not found" });
        });
    });

    describe("rate limiting", () => {
        it("should apply the global limiter to /api/v1 routes", async () => {
            await request(app).get("/api/v1/mentors/probe");

            expect(mockLimiterHits).toBe(1);
        });

        it("should not rate-limit internal service calls or health probes", async () => {
            await request(app).get("/internal/probe");
            await request(app).get("/internal/users/probe");
            await request(app).get("/health/live");

            expect(mockLimiterHits).toBe(0);
        });
    });

    describe("trace ids", () => {
        it("should generate a trace id when the caller sends none", async () => {
            const res = await request(app).get("/api/v1/mentors/probe");

            expect(res.headers["x-trace-id"]).toMatch(/^[0-9a-f-]{36}$/);
            expect(res.body.traceId).toBe(res.headers["x-trace-id"]);
        });

        it("should reuse the caller's X-Trace-Id", async () => {
            const res = await request(app).get("/api/v1/mentors/probe").set("x-trace-id", "trace-123");

            expect(res.headers["x-trace-id"]).toBe("trace-123");
            expect(res.body.traceId).toBe("trace-123");
        });

        it("should fall back to X-Request-Id", async () => {
            const res = await request(app).get("/api/v1/mentors/probe").set("x-request-id", "req-456");

            expect(res.headers["x-trace-id"]).toBe("req-456");
        });

        it("should prefer X-Trace-Id when both headers are present", async () => {
            const res = await request(app)
                .get("/api/v1/mentors/probe")
                .set("x-trace-id", "trace-1")
                .set("x-request-id", "req-2");

            expect(res.headers["x-trace-id"]).toBe("trace-1");
        });
    });

    describe("security middleware", () => {
        it("should set helmet's security headers", async () => {
            const res = await request(app).get("/api/v1/mentors/probe");

            expect(res.headers["x-content-type-options"]).toBe("nosniff");
        });

        it("should strip Mongo operator keys from JSON request bodies", async () => {
            const res = await request(app)
                .post("/api/v1/mentors/echo")
                .send({ ok: 2, $gt: 1, nested: { keep: 4, $ne: 3 } });

            expect(res.body.body).toEqual({ ok: 2, nested: { keep: 4 } });
        });

        it("should accept bodies larger than the 100kb Express default", async () => {
            const res = await request(app)
                .post("/api/v1/mentors/echo")
                .send({ blob: "x".repeat(200 * 1024) });

            expect(res.status).toBe(200);
            expect(res.body.body.blob).toHaveLength(200 * 1024);
        });
    });

    describe("Google OAuth callback headers", () => {
        it("should relax the opener policy and drop the CSP on the calendar callback", async () => {
            const res = await request(app).get("/api/v1/google-calendar/callback");

            expect(res.headers["cross-origin-opener-policy"]).toBe("unsafe-none");
            expect(res.headers["content-security-policy"]).toBeUndefined();
        });

        it("should keep the popup-friendly policy and the CSP everywhere else", async () => {
            const res = await request(app).get("/api/v1/google-calendar/probe");

            expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
            expect(res.headers["content-security-policy"]).toBeDefined();
        });

        it("should not relax the policy for another route's /callback path", async () => {
            const res = await request(app).get("/api/v1/availability/callback");

            expect(res.headers["cross-origin-opener-policy"]).toBe("same-origin-allow-popups");
        });
    });

    describe("CORS", () => {
        let previousOrigins;
        let previousFrontend;
        beforeAll(() => {
            previousOrigins = process.env.CORS_ORIGINS;
            previousFrontend = process.env.FRONTEND_URL;
            process.env.CORS_ORIGINS = "https://app.example.com, https://admin.example.com";
            process.env.FRONTEND_URL = "https://frontend.example.com";
        });
        afterAll(() => {
            if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
            else process.env.CORS_ORIGINS = previousOrigins;
            if (previousFrontend === undefined) delete process.env.FRONTEND_URL;
            else process.env.FRONTEND_URL = previousFrontend;
        });

        it.each([
            "https://app.example.com",
            "https://admin.example.com",
            "https://frontend.example.com",
        ])("should allow the configured origin %s", async (origin) => {
            const res = await request(app).get("/api/v1/mentors/probe").set("origin", origin);

            expect(res.status).toBe(200);
            expect(res.headers["access-control-allow-origin"]).toBe(origin);
            expect(res.headers["access-control-allow-credentials"]).toBe("true");
        });

        it("should allow requests with no Origin header (server-to-server)", async () => {
            const res = await request(app).get("/internal/probe");

            expect(res.status).toBe(200);
        });

        it("should block an origin that is not allowed", async () => {
            const res = await request(app).get("/api/v1/mentors/probe").set("origin", "https://evil.example");

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.headers["access-control-allow-origin"]).toBeUndefined();
        });

        it("should answer a preflight with the allowed methods and tracing headers", async () => {
            const res = await request(app)
                .options("/api/v1/mentors/probe")
                .set("origin", "https://app.example.com")
                .set("access-control-request-method", "PATCH")
                .set("access-control-request-headers", "x-trace-id, sentry-trace");

            expect(res.status).toBe(204);
            expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
            expect(res.headers["access-control-allow-headers"]).toMatch(/X-Trace-Id/i);
            expect(res.headers["access-control-allow-headers"]).toMatch(/sentry-trace/i);
        });
    });

    describe("error handling", () => {
        it("should map an AppError raised by a route to its status", async () => {
            const res = await request(app).get("/api/v1/mentors/boom");

            expect(res.status).toBe(409);
            expect(res.body).toMatchObject({ success: false, message: "conflict from route" });
        });

        it("should hide unexpected errors behind a generic 500", async () => {
            const res = await request(app).get("/api/v1/mentors/crash");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ success: false, message: "Internal server error" });
        });
    });
});
