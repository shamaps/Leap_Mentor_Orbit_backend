const request = require("supertest");

// ── Mocks: everything outside app.js itself, so only app.js wiring is under test ──
jest.mock("dotenv", () => ({ config: jest.fn() }));
jest.mock("@sentry/node", () => ({ setupExpressErrorHandler: jest.fn() }));
jest.mock("@leapmentor/shared/utils/logger", () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock("@leapmentor/shared/utils/requestContext", () => ({
    runWithTraceId: jest.fn((traceId, fn) => fn()),
}));
jest.mock("@leapmentor/shared/utils/appError", () => ({
    handleError: jest.fn((res, err, context) =>
        res.status(err.status || 500).json({ success: false, message: err.message, context })),
}));
jest.mock("@leapmentor/shared/middleware/rateLimiter", () => ({
    globalLimiter: jest.fn((req, res, next) => next()),
}));
jest.mock("@leapmentor/shared/utils/health", () => ({
    createHealthRouter: jest.fn(() => {
        const router = require("express").Router();
        router.get("/live", (req, res) => res.json({ status: "ok" }));
        return router;
    }),
}));

const mockStubRouter = (name) => {
    const router = require("express").Router();
    router.get("/ping", (req, res) => res.json({ router: name }));
    return router;
};

jest.mock("../../src/routes/auth.routes", () => {
    const router = mockStubRouter("auth");
    router.post("/echo", (req, res) => res.json({ body: req.body }));
    router.get("/boom", () => { throw new Error("kaboom"); });
    router.get("/ip", (req, res) => res.json({ ip: req.ip }));
    return router;
});
jest.mock("../../src/routes/verification.routes", () => mockStubRouter("verification"));
jest.mock("../../src/routes/user.routes", () => mockStubRouter("users"));
jest.mock("../../src/routes/admin", () => mockStubRouter("admin"));

const Sentry = require("@sentry/node");
const dotenv = require("dotenv");
const logger = require("@leapmentor/shared/utils/logger");
const { runWithTraceId } = require("@leapmentor/shared/utils/requestContext");
const { handleError } = require("@leapmentor/shared/utils/appError");
const { globalLimiter } = require("@leapmentor/shared/middleware/rateLimiter");
const { createHealthRouter } = require("@leapmentor/shared/utils/health");

const app = require("../../src/app");

// Calls made while app.js loads must be captured before any test clears the mocks.
const loadTimeCalls = {
    dotenv: dotenv.config.mock.calls.length,
    sentry: Sentry.setupExpressErrorHandler.mock.calls.map((c) => c[0]),
    health: createHealthRouter.mock.calls.map((c) => c[0]),
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe("Identity App Wiring (Integration)", () => {
    const savedEnv = { CORS_ORIGINS: process.env.CORS_ORIGINS, FRONTEND_URL: process.env.FRONTEND_URL };

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.CORS_ORIGINS;
        delete process.env.FRONTEND_URL;
    });

    afterAll(() => {
        Object.entries(savedEnv).forEach(([k, v]) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
    });

    describe("startup wiring", () => {
        it("should load environment variables once with dotenv", () => {
            expect(loadTimeCalls.dotenv).toBe(1);
        });

        it("should create the health router for the identity service", () => {
            expect(loadTimeCalls.health).toEqual([{ service: "identity" }]);
        });

        it("should register the Sentry express error handler on the app", () => {
            expect(loadTimeCalls.sentry).toEqual([app]);
        });

        it("should trust one proxy hop", () => {
            expect(app.get("trust proxy")).toBe(1);
        });
    });

    describe("health and rate limiting", () => {
        it("should serve /health/live without going through the global rate limiter", async () => {
            const res = await request(app).get("/health/live").expect(200);

            expect(res.body).toEqual({ status: "ok" });
            expect(globalLimiter).not.toHaveBeenCalled();
        });

        it("should apply the global rate limiter to /api/v1 routes", async () => {
            await request(app).get("/api/v1/auth/ping").expect(200);

            expect(globalLimiter).toHaveBeenCalledTimes(1);
        });

        it("should stop the request when the rate limiter rejects it", async () => {
            globalLimiter.mockImplementationOnce((req, res) => res.status(429).json({ success: false, message: "Too many requests" }));

            await request(app).get("/api/v1/auth/ping").expect(429);
        });
    });

    describe("route mounting", () => {
        it.each([
            ["/api/v1/auth/ping", "auth"],
            ["/api/v1/verification/ping", "verification"],
            ["/api/v1/users/ping", "users"],
            ["/api/v1/admin/ping", "admin"],
        ])("should mount %s on the %s router", async (path, name) => {
            const res = await request(app).get(path).expect(200);

            expect(res.body).toEqual({ router: name });
        });

        it("should not serve the routers without the /api/v1 prefix", async () => {
            await request(app).get("/auth/ping").expect(404);
        });
    });

    describe("trace id", () => {
        it("should generate a UUID trace id and return it in X-Trace-Id when none is sent", async () => {
            const res = await request(app).get("/api/v1/auth/ping");

            expect(res.headers["x-trace-id"]).toMatch(UUID);
            expect(runWithTraceId).toHaveBeenCalledWith(res.headers["x-trace-id"], expect.any(Function));
        });

        it("should reuse an incoming X-Trace-Id", async () => {
            const res = await request(app).get("/api/v1/auth/ping").set("X-Trace-Id", "trace-abc");

            expect(res.headers["x-trace-id"]).toBe("trace-abc");
        });

        it("should fall back to X-Request-Id when X-Trace-Id is missing", async () => {
            const res = await request(app).get("/api/v1/auth/ping").set("X-Request-Id", "req-123");

            expect(res.headers["x-trace-id"]).toBe("req-123");
        });

        it("should prefer X-Trace-Id over X-Request-Id", async () => {
            const res = await request(app).get("/api/v1/auth/ping").set("X-Trace-Id", "trace-1").set("X-Request-Id", "req-2");

            expect(res.headers["x-trace-id"]).toBe("trace-1");
        });

        it("should log every incoming request with its method and path", async () => {
            await request(app).get("/api/v1/auth/ping");

            expect(logger.info).toHaveBeenCalledWith("Incoming request", expect.objectContaining({ method: "GET", path: "/api/v1/auth/ping" }));
        });

        it("should log the client IP from X-Forwarded-For, since trust proxy is set before any request", async () => {
            const res = await request(app).get("/api/v1/auth/ip").set("X-Forwarded-For", "203.0.113.7");

            expect(res.body.ip).toBe("203.0.113.7");
            expect(logger.info).toHaveBeenCalledWith("Incoming request", expect.objectContaining({ ip: "203.0.113.7" }));
        });
    });

    describe("CORS", () => {
        it("should allow an origin listed in CORS_ORIGINS and enable credentials", async () => {
            process.env.CORS_ORIGINS = "http://localhost:5173, https://app.example.com";

            const res = await request(app).get("/api/v1/auth/ping").set("Origin", "https://app.example.com").expect(200);

            expect(res.headers["access-control-allow-origin"]).toBe("https://app.example.com");
            expect(res.headers["access-control-allow-credentials"]).toBe("true");
        });

        it("should allow the FRONTEND_URL origin", async () => {
            process.env.FRONTEND_URL = "https://frontend.example.com";

            const res = await request(app).get("/api/v1/auth/ping").set("Origin", "https://frontend.example.com").expect(200);

            expect(res.headers["access-control-allow-origin"]).toBe("https://frontend.example.com");
        });

        it("should allow requests with no Origin header (server-to-server, curl)", async () => {
            await request(app).get("/api/v1/auth/ping").expect(200);
        });

        it("should block an origin that is not allowed and hand the error to the global handler", async () => {
            process.env.CORS_ORIGINS = "https://app.example.com";

            const res = await request(app).get("/api/v1/auth/ping").set("Origin", "https://evil.example.com");

            expect(res.headers["access-control-allow-origin"]).toBeUndefined();
            expect(res.status).toBe(500);
            expect(res.body.message).toBe("CORS blocked: https://evil.example.com");
            expect(handleError).toHaveBeenCalled();
        });

        it("should block every origin when neither CORS_ORIGINS nor FRONTEND_URL is configured", async () => {
            const res = await request(app).get("/api/v1/auth/ping").set("Origin", "https://app.example.com");

            expect(res.status).toBe(500);
            expect(res.headers["access-control-allow-origin"]).toBeUndefined();
        });

        it("should answer a preflight request with the allowed methods and headers", async () => {
            process.env.CORS_ORIGINS = "https://app.example.com";

            const res = await request(app)
                .options("/api/v1/auth/ping")
                .set("Origin", "https://app.example.com")
                .set("Access-Control-Request-Method", "PATCH")
                .set("Access-Control-Request-Headers", "Authorization,X-Trace-Id");

            expect(res.status).toBe(204);
            expect(res.headers["access-control-allow-methods"]).toBe("GET,POST,PUT,PATCH,DELETE,OPTIONS");
            expect(res.headers["access-control-allow-headers"]).toBe(
                "Content-Type,Authorization,baggage,sentry-trace,Accept-Version,Accept,X-Request-Id,X-Client-Name,X-Client-Version,X-Trace-Id");
        });
    });

    describe("security middleware", () => {
        it("should set helmet security headers and hide X-Powered-By", async () => {
            const res = await request(app).get("/api/v1/auth/ping");

            expect(res.headers["x-content-type-options"]).toBe("nosniff");
            expect(res.headers["x-powered-by"]).toBeUndefined();
        });

        it("should strip MongoDB operator keys from the request body", async () => {
            const res = await request(app).post("/api/v1/auth/echo").send({ email: { $gt: "" }, name: "ok" });

            expect(res.body.body).toEqual({ email: {}, name: "ok" });
        });

        it("should keep keys that contain dots (allowDots)", async () => {
            const res = await request(app).post("/api/v1/auth/echo").send({ "profile.name": "Shama" });

            expect(res.body.body).toEqual({ "profile.name": "Shama" });
        });
    });

    describe("body parsing", () => {
        it("should parse JSON bodies", async () => {
            const res = await request(app).post("/api/v1/auth/echo").send({ a: 1 });

            expect(res.body.body).toEqual({ a: 1 });
        });

        it("should parse urlencoded bodies", async () => {
            const res = await request(app).post("/api/v1/auth/echo").type("form").send("a=1&b=two");

            expect(res.body.body).toEqual({ a: "1", b: "two" });
        });

        it("should reject JSON bodies larger than 10mb with 413", async () => {
            const res = await request(app).post("/api/v1/auth/echo").send({ blob: "x".repeat(11 * 1024 * 1024) });

            expect(res.status).toBe(413);
        });

        it("should reject malformed JSON with a 400 from the error handler", async () => {
            const res = await request(app).post("/api/v1/auth/echo").set("Content-Type", "application/json").send("{ not json");

            expect(res.status).toBe(400);
            expect(handleError).toHaveBeenCalled();
        });
    });

    describe("404 and error handling", () => {
        it("should return a JSON 404 naming the method and path for unknown routes", async () => {
            const res = await request(app).get("/api/v1/nope").expect(404);

            expect(res.body).toEqual({ success: false, message: "Route GET /api/v1/nope not found" });
        });

        it("should return the 404 JSON for unknown non-API paths too", async () => {
            const res = await request(app).delete("/whatever").expect(404);

            expect(res.body.message).toBe("Route DELETE /whatever not found");
        });

        it("should log an unhandled error and pass it to handleError with method and path as context", async () => {
            const res = await request(app).get("/api/v1/auth/boom");

            expect(res.status).toBe(500);
            expect(logger.error).toHaveBeenCalledWith("[global] Unhandled error", expect.objectContaining({
                method: "GET",
                path: "/api/v1/auth/boom",
                error: "kaboom",
            }));
            expect(handleError).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ message: "kaboom" }), "GET /api/v1/auth/boom");
            expect(res.body.context).toBe("GET /api/v1/auth/boom");
        });
    });
});
