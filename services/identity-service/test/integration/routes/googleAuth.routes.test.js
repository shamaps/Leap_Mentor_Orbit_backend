const request = require("supertest");
const express = require("express");

const mockGoogleAuth = jest.fn((req, res) => res.status(200).json({ success: true, data: { provider: "google" } }));
const mockClerkSSO = jest.fn((req, res) => res.status(200).json({ success: true, data: { provider: "clerk" } }));
const mockOauthLimiter = jest.fn((req, res, next) => next());

jest.mock("../../../src/config/container", () => {
    const passthrough = new Proxy({}, { get: () => (req, res) => res.status(200).json({ success: true }) });
    return {
        googleAuthController: { googleAuth: (req, res, next) => mockGoogleAuth(req, res, next) },
        clerkSSOController: { clerkSSO: (req, res, next) => mockClerkSSO(req, res, next) },
        registerController: passthrough,
        loginController: passthrough,
        changePasswordController: passthrough,
        forgotPasswordController: passthrough,
        refreshTokenController: passthrough,
    };
});

jest.mock("@leapmentor/shared/middleware/rateLimiter", () => {
    const pass = (req, res, next) => next();
    return {
        loginLimiter: pass,
        registerLimiter: pass,
        forgotPasswordLimiter: pass,
        otpLimiter: pass,
        oauthLimiter: (req, res, next) => mockOauthLimiter(req, res, next),
    };
});

jest.mock("@leapmentor/shared/middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => next()),
    requirePermission: jest.fn(() => (req, res, next) => next()),
}));

describe("Google and Clerk SSO Routing Channels (Integration)", () => {
    let app;

    beforeAll(() => {
        app = express();
        app.use(express.json());
        app.use("/auth", require("../../../src/routes/auth.routes"));
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it("POST /auth/google passes through the OAuth limiter and reaches the Google controller", async () => {
        const res = await request(app).post("/auth/google").send({ credential: "token" }).expect(200);

        expect(mockOauthLimiter).toHaveBeenCalled();
        expect(mockGoogleAuth).toHaveBeenCalled();
        expect(res.body.data.provider).toBe("google");
    });

    it("POST /auth/clerk-sso passes through the OAuth limiter and reaches the Clerk controller", async () => {
        const res = await request(app).post("/auth/clerk-sso").send({ clerkToken: "token" }).expect(200);

        expect(mockOauthLimiter).toHaveBeenCalled();
        expect(mockClerkSSO).toHaveBeenCalled();
        expect(res.body.data.provider).toBe("clerk");
    });

    it("blocks the request before the controller when the OAuth limiter rejects it", async () => {
        mockOauthLimiter.mockImplementationOnce((req, res) => res.status(429).json({ success: false }));

        await request(app).post("/auth/google").send({ credential: "token" }).expect(429);

        expect(mockGoogleAuth).not.toHaveBeenCalled();
    });
});
