/**
 * @fileoverview Unit tests for Verification Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    fail: jest.fn((res, msg, status) => res.status(status).json({ error: msg })),
}));

const createVerificationController = require("../../../controllers/verification.controller");
const { handleError } = require("../../../utils/appError");
const { ok, fail } = require("../../../utils/response");

describe("Verification Controller (100% Full Branch & Code Coverage)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            sendVerification: jest.fn(),
            resendVerification: jest.fn(),
            verifyOtp: jest.fn(),
            verifyLink: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createVerificationController(mockService, { logger: mockLogger });

        req = {
            body: { email: "user@test.com", otp: "123456" },
            params: { token: "magic_crypto_token_xyz" },
            query: { email: "user@test.com" }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("sendVerification endpoint", () => {
        it("should return ok if verification service responds with status 200", async () => {
            mockService.sendVerification.mockResolvedValue({ status: 200, body: { message: "Sent" } });
            await controller.sendVerification(req, res);
            expect(mockService.sendVerification).toHaveBeenCalledWith({ email: "user@test.com" });
            expect(ok).toHaveBeenCalledWith(res, { message: "Sent" });
        });

        it("should return fail if verification service responds with an alternate non-200 status code", async () => {
            mockService.sendVerification.mockResolvedValue({ status: 400, body: { message: "Invalid email structure" } });
            await controller.sendVerification(req, res);
            expect(fail).toHaveBeenCalledWith(res, "Invalid email structure", 400);
        });

        it("should route service exceptions inside the try-catch block directly to handleError", async () => {
            const err = new Error("Network pool timeout");
            mockService.sendVerification.mockRejectedValue(err);
            await controller.sendVerification(req, res);
            expect(handleError).toHaveBeenCalledWith(res, err, "verification.sendVerification");
        });
    });

    describe("resendVerification endpoint", () => {
        it("should return ok if resend service responds with status 200", async () => {
            mockService.resendVerification.mockResolvedValue({ status: 200, body: { message: "Resent" } });
            await controller.resendVerification(req, res);
            expect(mockService.resendVerification).toHaveBeenCalledWith({ email: "user@test.com" });
            expect(ok).toHaveBeenCalledWith(res, { message: "Resent" });
        });

        it("should return fail if resend service responds with an alternate non-200 status code", async () => {
            mockService.resendVerification.mockResolvedValue({ status: 429, body: { message: "Rate limit reached" } });
            await controller.resendVerification(req, res);
            expect(fail).toHaveBeenCalledWith(res, "Rate limit reached", 429);
        });

        it("should route service exceptions inside the try-catch block directly to handleError", async () => {
            const err = new Error("Cluster lookup fail");
            mockService.resendVerification.mockRejectedValue(err);
            await controller.resendVerification(req, res);
            expect(handleError).toHaveBeenCalledWith(res, err, "verification.resendVerification");
        });
    });

    describe("verifyOtp endpoint", () => {
        it("should return ok if verifyOtp service responds with status 200", async () => {
            mockService.verifyOtp.mockResolvedValue({ status: 200, body: { success: true } });
            await controller.verifyOtp(req, res);
            expect(mockService.verifyOtp).toHaveBeenCalledWith({ email: "user@test.com", otp: "123456" });
            expect(ok).toHaveBeenCalledWith(res, { success: true });
        });

        it("should return fail if verifyOtp service responds with an alternate non-200 status code", async () => {
            mockService.verifyOtp.mockResolvedValue({ status: 401, body: { message: "Incorrect OTP code entry" } });
            await controller.verifyOtp(req, res);
            expect(fail).toHaveBeenCalledWith(res, "Incorrect OTP code entry", 401);
        });

        it("should route service exceptions inside the try-catch block directly to handleError", async () => {
            const err = new Error("Verification instance engine crash");
            mockService.verifyOtp.mockRejectedValue(err);
            await controller.verifyOtp(req, res);
            expect(handleError).toHaveBeenCalledWith(res, err, "verification.verifyOtp");
        });
    });

    describe("verifyLink endpoint", () => {
        it("should return ok if verifyLink service responds with status 200", async () => {
            mockService.verifyLink.mockResolvedValue({ status: 200, body: { verified: true } });
            await controller.verifyLink(req, res);
            expect(mockService.verifyLink).toHaveBeenCalledWith({ token: "magic_crypto_token_xyz", email: "user@test.com" });
            expect(ok).toHaveBeenCalledWith(res, { verified: true });
        });

        it("should return fail if verifyLink service responds with an alternate non-200 status code", async () => {
            mockService.verifyLink.mockResolvedValue({ status: 400, body: { message: "Cryptographic link expired" } });
            await controller.verifyLink(req, res);
            expect(fail).toHaveBeenCalledWith(res, "Cryptographic link expired", 400);
        });

        it("should route service exceptions inside the try-catch block directly to handleError", async () => {
            const err = new Error("Link parameter validation fatal error");
            mockService.verifyLink.mockRejectedValue(err);
            await controller.verifyLink(req, res);
            expect(handleError).toHaveBeenCalledWith(res, err, "verification.verifyLink");
        });
    });
});