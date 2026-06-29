jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createChangePasswordController = require("../../../controllers/changePassword.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Change Password Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = { changePassword: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createChangePasswordController(mockService, { logger: mockLogger });

        req = { user: { _id: "user_id_123" }, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    it("should extract fields, delegate to service, and return success payload", async () => {
        req.body = { currentPassword: "OldPassword1!", newPassword: "SecureNewPassword1!" };
        const servicePayload = { message: "Password changed successfully" };
        mockService.changePassword.mockResolvedValue(servicePayload);

        await controller.changePassword(req, res);

        expect(mockService.changePassword).toHaveBeenCalledWith("user_id_123", "OldPassword1!", "SecureNewPassword1!");
        expect(ok).toHaveBeenCalledWith(res, servicePayload);
    });

    it("should funnel runtime rejections down to the app error utility block", async () => {
        const testError = new Error("Service layer failure");
        mockService.changePassword.mockRejectedValue(testError);

        await controller.changePassword(req, res);

        expect(handleError).toHaveBeenCalledWith(res, testError, "changePassword.changePassword");
    });
});