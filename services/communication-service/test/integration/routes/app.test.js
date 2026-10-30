/**
 * @fileoverview Wiring tests for the Communication Express app: mounting, trace ids, security
 * middleware, body sanitising and error handling. Route modules are replaced by stubs, so
 * only app.js itself is under test.
 */

const request = require("supertest");

let mockLimiterHits = 0;

// Every route module becomes a tiny router that identifies itself.
const mockMakeRouter = (name) => {
    const express = require("express");
    const AppError = require("@leapmentor/shared/utils/appError");
    const router = express.Router();
    router.get("/probe", (req, res) => res.json({ mounted: name, traceId: req.traceId }));
    router.post("/echo", (req, res) => res.json({ body: req.body }));
    router.get("/boom", (req, res, next) => next(new AppError(409, "conflict from route")));
    router.get("/crash", (req, res, next) => next(new Error("kaboom")));
    return router;
};

jest.mock("../../../src/routes/internal.routes", () => mockMakeRouter("internal"));
jest.mock("../../../src/routes/message.routes", () => mockMakeRouter("messages"));
jest.mock("../../../src/routes/notifications.routes", () => mockMakeRouter("notifications"));

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

describe("Communication app wiring (Integration)", () => {
    describe("route mounting", () => {
        it.each([
            ["/internal/probe", "internal"],
            ["/api/v1/messages/probe", "messages"],
            ["/api/v1/notifications/probe", "notifications"],
        ])("should serve %s from the %s router", async (path, name) => {
            const res = await request(app).get(path);

            expect(res.status).toBe(200);
            expect(res.body.mounted).toBe(name);
        });

        it("should answer health probes", async () => {
            const res = await request(app).get("/health/live");

            expect(res.status).toBe(200);
            expect(res.body).toEqual({ service: "communication" });
        });

        it("should return a JSON 404 for unknown routes", async () => {
            const res = await request(app).get("/nope");

            expect(res.status).toBe(404);
            expect(res.body).toEqual({ success: false, message: "Route GET /nope not found" });
        });
    });

    describe("rate limiting", () => {
        it("should apply the global limiter to /api/v1 routes", async () => {
            await request(app).get("/api/v1/messages/probe");

            expect(mockLimiterHits).toBe(1);
        });

        it("should not rate-limit internal service calls or health probes", async () => {
            await request(app).get("/internal/probe");
            await request(app).get("/health/live");

            expect(mockLimiterHits).toBe(0);
        });
    });

    describe("trace ids", () => {
        it("should generate a trace id when the caller sends none", async () => {
            const res = await request(app).get("/api/v1/messages/probe");

            expect(res.headers["x-trace-id"]).toMatch(/^[0-9a-f-]{36}$/);
            expect(res.body.traceId).toBe(res.headers["x-trace-id"]);
        });

        it("should reuse the caller's X-Trace-Id", async () => {
            const res = await request(app).get("/api/v1/messages/probe").set("x-trace-id", "trace-123");

            expect(res.headers["x-trace-id"]).toBe("trace-123");
            expect(res.body.traceId).toBe("trace-123");
        });

        it("should fall back to X-Request-Id", async () => {
            const res = await request(app).get("/api/v1/messages/probe").set("x-request-id", "req-456");

            expect(res.headers["x-trace-id"]).toBe("req-456");
        });
    });

    describe("security middleware", () => {
        it("should set helmet's security headers", async () => {
            const res = await request(app).get("/api/v1/messages/probe");

            expect(res.headers["x-content-type-options"]).toBe("nosniff");
        });

        it("should strip Mongo operator keys from request bodies", async () => {
            const res = await request(app)
                .post("/api/v1/messages/echo")
                .send({ ok: 2, $gt: 1, nested: { keep: 4, $ne: 3 } });

            expect(res.body.body).toEqual({ ok: 2, nested: { keep: 4 } });
        });

        it("should sanitise bodies sent to internal routes too", async () => {
            const res = await request(app).post("/internal/echo").send({ ok: 1, $where: "x" });

            expect(res.body.body).toEqual({ ok: 1 });
        });
    });

    describe("CORS", () => {
        let previousOrigins;
        beforeAll(() => {
            previousOrigins = process.env.CORS_ORIGINS;
            process.env.CORS_ORIGINS = "https://app.example.com";
        });
        afterAll(() => {
            if (previousOrigins === undefined) delete process.env.CORS_ORIGINS;
            else process.env.CORS_ORIGINS = previousOrigins;
        });

        it("should allow an origin from CORS_ORIGINS", async () => {
            const res = await request(app).get("/api/v1/messages/probe").set("origin", "https://app.example.com");

            expect(res.status).toBe(200);
            expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
        });

        it("should allow requests with no Origin header (server-to-server)", async () => {
            const res = await request(app).get("/internal/probe");

            expect(res.status).toBe(200);
        });

        it("should block an origin that is not allowed", async () => {
            const res = await request(app).get("/api/v1/messages/probe").set("origin", "https://evil.example");

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.headers["access-control-allow-origin"]).toBeUndefined();
        });
    });

    describe("error handling", () => {
        it("should map an AppError raised by a route to its status", async () => {
            const res = await request(app).get("/api/v1/messages/boom");

            expect(res.status).toBe(409);
            expect(res.body).toMatchObject({ success: false, message: "conflict from route" });
        });

        it("should hide unexpected errors behind a generic 500", async () => {
            const res = await request(app).get("/api/v1/messages/crash");

            expect(res.status).toBe(500);
            expect(res.body).toEqual({ success: false, message: "Internal server error" });
        });
    });
});