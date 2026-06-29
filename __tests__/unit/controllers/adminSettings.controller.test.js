/**
 * @fileoverview Unit tests for Admin Settings Controller.
 * Validates envelope formatting, response macros, and request parameters translation.
 */

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createAdminSettingsController = require("../../../controllers/admin/adminSettings.controller");
const { ok, created } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Admin Settings Controller", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            getOverview: jest.fn(),
            changePassword: jest.fn(),
            addAdmin: jest.fn(),
            getCommission: jest.fn(),
            updateCommission: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createAdminSettingsController(mockService, { logger: mockLogger });

        req = { admin: { _id: "admin_root_1" }, body: {}, query: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getOverview", () => {
        it("should fetch dashboard metrics overview profile envelope", async () => {
            const mockResult = { totalUsers: 50, activeSessions: 5 };
            mockService.getOverview.mockResolvedValue(mockResult);

            await controller.getOverview(req, res);

            expect(mockService.getOverview).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should funnel runtime exceptions to the error translation wrapper", async () => {
            const error = new Error("Platform settings breakdown");
            mockService.getOverview.mockRejectedValue(error);

            await controller.getOverview(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "adminSettings.getOverview");
        });
    });

    describe("changePassword", () => {
        it("should securely map payload data and delegate down to the service index", async () => {
            req.body = { currentPassword: "OldPassword1!", newPassword: "NewPassword1!" };
            const serviceResponse = { message: "Password changed successfully." };
            mockService.changePassword.mockResolvedValue(serviceResponse);

            await controller.changePassword(req, res);

            expect(mockService.changePassword).toHaveBeenCalledWith("admin_root_1", "OldPassword1!", "NewPassword1!");
            expect(ok).toHaveBeenCalledWith(res, serviceResponse);
        });
    });

    describe("addAdmin", () => {
        it("should issue status 201 via the created envelope utility upon allocation success", async () => {
            req.body = { name: "Sub Admin", email: "sub@test.com" };
            const subAdminResult = { message: "Account created" };
            mockService.addAdmin.mockResolvedValue(subAdminResult);

            await controller.addAdmin(req, res);

            expect(mockService.addAdmin).toHaveBeenCalledWith("Sub Admin", "sub@test.com");
            expect(created).toHaveBeenCalledWith(res, subAdminResult);
        });
    });

    describe("updateCommission", () => {
        it("should pass numeric commission variables through to the service boundary layers", async () => {
            req.body = { commissionRate: 15 };
            mockService.updateCommission.mockResolvedValue({ commissionRate: 15 });

            await controller.updateCommission(req, res);

            expect(mockService.updateCommission).toHaveBeenCalledWith("admin_root_1", 15);
        });
    });
});