/**
 * @fileoverview Unit tests for Forgot Password Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createForgotPasswordController = require("../../../controllers/forgotPassword.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Forgot Password Controller (100% Comprehensive Coverage Blueprint)", () => {
    let mockService, mockLogger, controller, req, res, next;

    beforeEach(() => {
        mockService = {
            sendForgotPasswordOTP: jest.fn(),
            verifyResetOTP: jest.fn(),
            resetPassword: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        next = jest.fn();
        controller = createForgotPasswordController(mockService, { logger: mockLogger });

        req = {
            body: {
                email: "recovery@test.com",
                otp: "777888",
                newPassword: "SuperSecurePassword2026!"
            },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("sendForgotPasswordOTP Endpoint", () => {
        it("should issue an OTP and return a generic security-hardened message block on success", async () => {
            mockService.sendForgotPasswordOTP.mockResolvedValue();

            await controller.sendForgotPasswordOTP(req, res, next);

            expect(mockService.sendForgotPasswordOTP).toHaveBeenCalledWith("recovery@test.com");
            expect(ok).toHaveBeenCalledWith(res, { message: "If this email exists, an OTP has been sent." });
        });

        it("should route internal processing failures down through the handleError helper flow", async () => {
            const err = new Error("Mailing provider cluster breakdown");
            mockService.sendForgotPasswordOTP.mockRejectedValue(err);

            await controller.sendForgotPasswordOTP(req, res, next);

            expect(handleError).toHaveBeenCalledWith(res, err, "forgotPassword.sendForgotPasswordOTP");
        });
    });

    describe("verifyResetOTP Endpoint", () => {
        it("should verify inputs and output the normalized email parameter matching token confirmations", async () => {
            mockService.verifyResetOTP.mockResolvedValue("normalized@test.com");

            await controller.verifyResetOTP(req, res, next);

            expect(mockService.verifyResetOTP).toHaveBeenCalledWith({ email: "recovery@test.com", otp: "777888" });
            expect(ok).toHaveBeenCalledWith(res, { message: "OTP verified", email: "normalized@test.com" });
        });

        it("should route passcode verification faults straight down into the handleError structure", async () => {
            const err = new Error("OTP code either expired or structurally unaligned");
            mockService.verifyResetOTP.mockRejectedValue(err);

            await controller.verifyResetOTP(req, res, next);

            expect(handleError).toHaveBeenCalledWith(res, err, "forgotPassword.verifyResetOTP");
        });
    });

    describe("resetPassword Endpoint", () => {
        it("should apply credential string adjustments successfully across storage registers", async () => {
            mockService.resetPassword.mockResolvedValue();

            await controller.resetPassword(req, res, next);

            expect(mockService.resetPassword).toHaveBeenCalledWith({
                email: "recovery@test.com",
                otp: "777888",
                newPassword: "SuperSecurePassword2026!"
            });
            expect(ok).toHaveBeenCalledWith(res, { message: "Password reset successfully. You can now login." });
        });

        it("should route password mutation deadlock errors directly to the handleError middleware", async () => {
            const err = new Error("Write constraints index collision failure");
            mockService.resetPassword.mockRejectedValue(err);

            await controller.resetPassword(req, res, next);

            expect(handleError).toHaveBeenCalledWith(res, err, "forgotPassword.resetPassword");
        });
    });
});