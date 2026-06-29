const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockSendVerificationMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, message: "Sent" }));
const mockVerifyOtpMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, message: "Verified" }));

jest.mock("../../../config/container", () => ({
    verificationController: {
        sendVerification: (req, res, next) => mockSendVerificationMiddleware(req, res, next),
        verifyOtp: (req, res, next) => mockVerifyOtpMiddleware(req, res, next),
        resendVerification: jest.fn(),
        verifyLink: jest.fn(),
    },
}));

// Mock Joi boundary verification layers explicitly to isolate routing tests components cleanly
jest.mock("../../../middleware/validate", () => () => (req, res, next) => next());

jest.mock("../../../middleware/rateLimiter", () => ({
    otpLimiter: (req, res, next) => next(),
    resendLimiter: (req, res, next) => next(),
}));

describe("Account Activation and Verification Gateway (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const verificationRoutes = require("../../../routes/verification.routes");
        app.use("/verification", verificationRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /verification/send should clear rate limit constraints blocks and forward payloads directly", async () => {
        await request(app)
            .post("/verification/send")
            .send({ email: "jane@example.com" })
            .expect(200);

        expect(mockSendVerificationMiddleware).toHaveBeenCalled();
    });

    it("POST /verification/verify-otp should route correctly through Joi checking schema blocks", async () => {
        await request(app)
            .post("/verification/verify-otp")
            .send({ email: "jane@example.com", otp: "482913" })
            .expect(200);

        expect(mockVerifyOtpMiddleware).toHaveBeenCalled();
    });
});