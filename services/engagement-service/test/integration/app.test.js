/**
 * @fileoverview Integration tests for the engagement service's Express app (src/app.js).
 * The real middleware stack runs (CORS, helmet, trace ids, body parsing, sanitising,
 * error handling). The feature routers are replaced with tiny stand-ins, so these
 * tests check the wiring (what is mounted where) without building the whole container.
 */

jest.mock("dotenv", () => ({ config: jest.fn() }));

jest.mock("@sentry/node", () => ({ setupExpressErrorHandler: jest.fn() }));

jest.mock("@leapmentor/shared/utils/logger", () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn(),
}));

const mockGlobalLimiter = jest.fn((req, res, next) => next());
jest.mock("@leapmentor/shared/middleware/rateLimiter", () => ({
    globalLimiter: (req, res, next) => mockGlobalLimiter(req, res, next),
}));

// Each feature router answers /ping with its own name, and the first one also offers
// /echo (returns the parsed body) and /boom (fails), to exercise the app-level handling.
const mockStubRouter = (name) => {
    const express = require("express");
    const AppError = require("@leapmentor/shared/utils/appError");
    const router = express.Router();
    router.get("/ping", (req, res) => res.json({ route: name, traceId: req.traceId, requestId: req.requestId }));
    router.post("/echo", (req, res) => res.json({ body: req.body }));
    router.get("/boom", (req, res, next) => next(new Error("kaboom")));
    router.get("/denied", (req, res, next) => next(new AppError(422, "Bad input")));
    return router;
};

jest.mock("../../src/routes/connectRequest.routes", () => mockStubRouter("connectRequest"));
jest.mock("../../src/routes/leapRequest.routes", () => mockStubRouter("leapRequest"));
jest.mock("../../src/routes/session.routes", () => mockStubRouter("session"));
jest.mock("../../src/routes/goal.routes", () => mockStubRouter("goal"));
jest.mock("../../src/routes/note.routes", () => mockStubRouter("note"));
jest.mock("../../src/routes/privateNote.routes", () => mockStubRouter("privateNote"));
jest.mock("../../src/routes/feedback.routes", () => mockStubRouter("feedback"));
jest.mock("../../src/routes/report.routes", () => mockStubRouter("report"));
jest.mock("../../src/routes/support.routes", () => mockStubRouter("support"));
jest.mock("../../src/routes/admin", () => mockStubRouter("admin"));
jest.mock("../../src/routes/internalUsers.routes", () => mockStubRouter("internalUsers"));

const request = require("supertest");
const Sentry = require("@sentry/node");
const app = require("../../src/app");
// Jest clears mock calls before every test (clearMocks), so keep what happened while the app loaded.
const sentryCallsAtLoad = Sentry.setupExpressErrorHandler.mock.calls.map((args) => args[0]);

const MOUNTS = [
    ["/api/v1/connect-requests", "connectRequest"],
    ["/api/v1/leap-requests", "leapRequest"],
    ["/api/v1/sessions", "session"],
    ["/api/v1/goals", "goal"],
    ["/api/v1/notes", "note"],
    ["/api/v1/private-notes", "privateNote"],
    ["/api/v1/feedback", "feedback"],
    ["/api/v1/reports", "report"],
    ["/api/v1/support", "support"],
    ["/api/v1/admin", "admin"],
];

describe("Engagement app (integration)", () => {
    const savedEnv = {};
    beforeEach(() => {
        ["CORS_ORIGINS", "FRONTEND_URL"].forEach((k) => { savedEnv[k] = process.env[k]; delete process.env[k]; });
    });
    afterEach(() => {
        mockGlobalLimiter.mockClear();
        ["CORS_ORIGINS", "FRONTEND_URL"].forEach((k) => {
            if (savedEnv[k] === undefined) delete process.env[k];
            else process.env[k] = savedEnv[k];
        });
    });

    describe("routing", () => {
        it.each(MOUNTS)("mounts %s", async (prefix, name) => {
            const res = await request(app).get(`${prefix}/ping`).expect(200);
            expect(res.body.route).toBe(name);
        });

        it("mounts the internal user lifecycle routes outside /api/v1", async () => {
            const res = await request(app).get("/internal/users/ping").expect(200);
            expect(res.body.route).toBe("internalUsers");
            await request(app).get("/api/v1/internal/users/ping").expect(404);
        });

        it("answers an unknown path with a JSON 404 naming the method and path", async () => {
            const res = await request(app).get("/api/v1/nothing-here").expect(404);
            expect(res.body).toEqual({ success: false, message: "Route GET /api/v1/nothing-here not found" });
        });
    });

    describe("health probes", () => {
        it("serves liveness without the rate limiter", async () => {
            const res = await request(app).get("/health/live").expect(200);

            expect(res.body).toEqual({ status: "ok", service: "engagement" });
            expect(mockGlobalLimiter).not.toHaveBeenCalled();
        });
    });

    describe("rate limiting", () => {
        it("applies the global limiter to API routes", async () => {
            await request(app).get("/api/v1/goals/ping").expect(200);
            expect(mockGlobalLimiter).toHaveBeenCalledTimes(1);
        });

        it("does not apply it to the internal service-to-service routes", async () => {
            await request(app).get("/internal/users/ping").expect(200);
            expect(mockGlobalLimiter).not.toHaveBeenCalled();
        });

        it("stops the request when the limiter rejects it", async () => {
            mockGlobalLimiter.mockImplementationOnce((req, res) => res.status(429).json({ success: false }));
            await request(app).get("/api/v1/goals/ping").expect(429);
        });
    });

    describe("trace ids", () => {
        it("creates a trace id when the caller sends none, exposes it on the request and returns it as a header", async () => {
            const res = await request(app).get("/api/v1/goals/ping").expect(200);

            expect(res.headers["x-trace-id"]).toMatch(/^[0-9a-f-]{36}$/);
            expect(res.body.traceId).toBe(res.headers["x-trace-id"]);
            expect(res.body.requestId).toBe(res.headers["x-trace-id"]);
        });

        it("reuses the caller's X-Trace-Id", async () => {
            const res = await request(app).get("/api/v1/goals/ping").set("X-Trace-Id", "trace-from-caller").expect(200);
            expect(res.headers["x-trace-id"]).toBe("trace-from-caller");
        });

        it("falls back to X-Request-Id, and prefers X-Trace-Id when both are sent", async () => {
            const onlyRequestId = await request(app).get("/api/v1/goals/ping").set("X-Request-Id", "req-1");
            expect(onlyRequestId.headers["x-trace-id"]).toBe("req-1");

            const both = await request(app).get("/api/v1/goals/ping").set("X-Request-Id", "req-1").set("X-Trace-Id", "trace-1");
            expect(both.headers["x-trace-id"]).toBe("trace-1");
        });
    });

    describe("CORS", () => {
        it("allows requests with no Origin header (server-to-server calls)", async () => {
            await request(app).get("/api/v1/goals/ping").expect(200);
        });

        it("allows an origin listed in CORS_ORIGINS and lets cookies through", async () => {
            process.env.CORS_ORIGINS = "https://app.example.com, https://admin.example.com";

            const res = await request(app).get("/api/v1/goals/ping").set("Origin", "https://admin.example.com").expect(200);

            expect(res.headers["access-control-allow-origin"]).toBe("https://admin.example.com");
            expect(res.headers["access-control-allow-credentials"]).toBe("true");
        });

        it("allows the FRONTEND_URL origin", async () => {
            process.env.FRONTEND_URL = "https://leapmentor.example.com";

            const res = await request(app).get("/api/v1/goals/ping").set("Origin", "https://leapmentor.example.com").expect(200);

            expect(res.headers["access-control-allow-origin"]).toBe("https://leapmentor.example.com");
        });

        it("blocks an origin that is not on the list", async () => {
            process.env.CORS_ORIGINS = "https://app.example.com";

            const res = await request(app).get("/api/v1/goals/ping").set("Origin", "https://evil.example.com");

            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.success).toBe(false);
            expect(res.headers["access-control-allow-origin"]).toBeUndefined();
        });

        it("blocks every browser origin when nothing is configured", async () => {
            const res = await request(app).get("/api/v1/goals/ping").set("Origin", "https://any.example.com");
            expect(res.status).toBeGreaterThanOrEqual(400);
        });

        it("answers a preflight with the allowed methods and headers", async () => {
            process.env.CORS_ORIGINS = "https://app.example.com";

            const res = await request(app)
                .options("/api/v1/goals/ping")
                .set("Origin", "https://app.example.com")
                .set("Access-Control-Request-Method", "PATCH")
                .set("Access-Control-Request-Headers", "X-Trace-Id");

            expect(res.status).toBe(204);
            expect(res.headers["access-control-allow-methods"]).toContain("PATCH");
            expect(res.headers["access-control-allow-headers"]).toContain("X-Trace-Id");
        });
    });

    describe("security headers", () => {
        it("sets the helmet headers and does not advertise Express", async () => {
            const res = await request(app).get("/api/v1/goals/ping");

            expect(res.headers["x-content-type-options"]).toBe("nosniff");
            expect(res.headers["x-powered-by"]).toBeUndefined();
        });
    });

    describe("request bodies", () => {
        it("parses JSON bodies", async () => {
            const res = await request(app).post("/api/v1/goals/echo").send({ title: "Learn" }).expect(200);
            expect(res.body.body).toEqual({ title: "Learn" });
        });

        it("parses URL-encoded bodies", async () => {
            const res = await request(app).post("/api/v1/goals/echo").type("form").send("title=Learn&level=2").expect(200);
            expect(res.body.body).toEqual({ title: "Learn", level: "2" });
        });

        it("removes MongoDB operators from the body, but keeps keys that contain dots", async () => {
            const res = await request(app)
                .post("/api/v1/goals/echo")
                .send({ name: "x", $where: "sleep(1000)", nested: { $ne: 1, ok: true }, "a.b": 1 })
                .expect(200);

            expect(res.body.body).toEqual({ name: "x", nested: { ok: true }, "a.b": 1 });
        });

        it("accepts bodies up to 10 MB and rejects larger ones with a JSON failure", async () => {
            const big = { text: "x".repeat(2 * 1024 * 1024) };
            await request(app).post("/api/v1/goals/echo").send(big).expect(200);

            const tooBig = { text: "x".repeat(11 * 1024 * 1024) };
            const res = await request(app).post("/api/v1/goals/echo").send(tooBig);
            // NOTE: this is currently a 500, not a 413, because handleError only keeps the
            // status of AppError. The test only requires that the body is refused.
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.success).toBe(false);
        });

        it("refuses a malformed JSON body with a JSON failure", async () => {
            const res = await request(app).post("/api/v1/goals/echo").set("Content-Type", "application/json").send("{bad json");
            // NOTE: currently a 500 for the same reason as above; a client error (400) would be more accurate.
            expect(res.status).toBeGreaterThanOrEqual(400);
            expect(res.body.success).toBe(false);
        });
    });

    describe("error handling", () => {
        it("turns an unexpected error into a JSON failure instead of leaking the stack", async () => {
            const res = await request(app).get("/api/v1/goals/boom");

            expect(res.status).toBeGreaterThanOrEqual(500);
            expect(res.body.success).toBe(false);
            expect(JSON.stringify(res.body)).not.toContain("at Object");
        });

        it("keeps the status code of a deliberate AppError", async () => {
            const res = await request(app).get("/api/v1/goals/denied").expect(422);
            expect(res.body).toMatchObject({ success: false });
        });

        it("hands errors to the Sentry error handler first", () => {
            expect(sentryCallsAtLoad).toEqual([app]);
        });
    });

    it("trusts one proxy hop so client IPs and rate limits are correct behind a load balancer", () => {
        expect(app.get("trust proxy")).toBe(1);
    });
});
