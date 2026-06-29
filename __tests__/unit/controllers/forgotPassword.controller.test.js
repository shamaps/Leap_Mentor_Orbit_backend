jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createForgotPasswordController = require("../../../controllers/forgotPassword.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Forgot Password Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            sendForgotPasswordOTP: jest.fn(),
            verifyResetOTP: jest.fn(),
            resetPassword: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createForgotPasswordController(mockService, { logger: mockLogger });

        req = { body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("sendForgotPasswordOTP", () => {
        it("should initiate OTP generation and respond with a uniform success message envelope", async () => {
            req.body.email = "test@leapmentor.com";
            mockService.sendForgotPasswordOTP.mockResolvedValue();

            await controller.sendForgotPasswordOTP(req, res);

            expect(mockService.sendForgotPasswordOTP).toHaveBeenCalledWith("test@leapmentor.com");
            expect(ok).toHaveBeenCalledWith(res, { message: "If this email exists, an OTP has been sent." });
        });

        it("should tunnel internal exceptions securely to application error handlers", async () => {
            const error = new Error("SMTP Outage");
            mockService.sendForgotPasswordOTP.mockRejectedValue(error);

            await controller.sendForgotPasswordOTP(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "forgotPassword.sendForgotPasswordOTP");
        });
    });

    describe("verifyResetOTP", () => {
        it("should process credentials and return the normalized email on success", async () => {
            req.body = { email: " MIXEDcase@Test.com ", otp: "123456" };
            mockService.verifyResetOTP.mockResolvedValue("mixedcase@test.com");

            await controller.verifyResetOTP(req, res);

            expect(mockService.verifyResetOTP).toHaveBeenCalledWith({ email: " MIXEDcase@Test.com ", otp: "123456" });
            expect(ok).toHaveBeenCalledWith(res, { message: "OTP verified", email: "mixedcase@test.com" });
        });
    });

    describe("resetPassword", () => {
        it("should coordinate password mutations and return completion statuses", async () => {
            req.body = { email: "test@test.com", otp: "123456", newPassword: "new_secure_pass" };
            mockService.resetPassword.mockResolvedValue();

            await controller.resetPassword(req, res);

            expect(mockService.resetPassword).toHaveBeenCalledWith(req.body);
            expect(ok).toHaveBeenCalledWith(res, { message: "Password reset successfully. You can now login." });
        });
    });
});