jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
    fail: jest.fn((res, msg, status) => res.status(status).json({ success: false, error: msg })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createVerificationController = require("../../../controllers/verification.controller");
const { ok, fail } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Verification Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            sendVerification: jest.fn(),
            resendVerification: jest.fn(),
            verifyOtp: jest.fn(),
            verifyLink: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createVerificationController(mockService, { logger: mockLogger });

        req = { body: {}, params: {}, query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("sendVerification", () => {
        it("should accept user emails and invoke the underlying service, responding with 200 on success", async () => {
            req.body.email = "onboard@test.com";
            mockService.sendVerification.mockResolvedValue({ status: 200, body: { message: "Sent" } });

            await controller.sendVerification(req, res);

            expect(mockService.sendVerification).toHaveBeenCalledWith({ email: "onboard@test.com" });
            expect(ok).toHaveBeenCalledWith(res, { message: "Sent" });
        });

        it("should redirect downstream failure payloads cleanly to standard error envelopes", async () => {
            req.body.email = "verified@test.com";
            mockService.sendVerification.mockResolvedValue({ status: 400, body: { message: "Already verified" } });

            await controller.sendVerification(req, res);

            expect(fail).toHaveBeenCalledWith(res, "Already verified", 400);
            expect(ok).not.toHaveBeenCalled();
        });

        it("should handle unexpected execution errors safely via global utility hooks", async () => {
            const error = new Error("SMTP server unreachable");
            mockService.sendVerification.mockRejectedValue(error);

            await controller.sendVerification(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "verification.sendVerification");
        });
    });

    describe("verifyLink", () => {
        it("should parse parameters out of both path segments and request queries successfully", async () => {
            req.params.token = "crypto_magic_hex_string";
            req.query.email = "verify@test.com";
            mockService.verifyLink.mockResolvedValue({ status: 200, body: { message: "Verified" } });

            await controller.verifyLink(req, res);

            expect(mockService.verifyLink).toHaveBeenCalledWith({ token: "crypto_magic_hex_string", email: "verify@test.com" });
        });
    });
});