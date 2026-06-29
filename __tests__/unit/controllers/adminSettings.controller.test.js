/**
 * @fileoverview Unit tests for Admin Settings Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
}));

const createAdminSettingsController = require("../../../controllers/admin/adminSettings.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created } = require("../../../utils/response");

describe("Admin Settings Controller (100% Comprehensive Coverage Blueprint)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            getOverview: jest.fn(),
            changePassword: jest.fn(),
            addAdmin: jest.fn(),
            getCommission: jest.fn(),
            updateCommission: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createAdminSettingsController(mockService, { logger: mockLogger });

        req = {
            body: {
                currentPassword: "old_password_123",
                newPassword: "new_secure_password_789",
                name: "Super Admin",
                email: "super@admin.com",
                commissionRate: 15
            },
            admin: { _id: "admin_root_001" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("getOverview Endpoint", () => {
        it("should return system overview summary rows indices successfully", async () => {
            const mockOverviewData = { totalUsers: 1500, totalEscrow: 45000 };
            mockService.getOverview.mockResolvedValue(mockOverviewData);

            await controller.getOverview(req, res);

            expect(mockService.getOverview).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledWith(res, mockOverviewData);
        });

        it("should route service overview failures directly down to handleError handler", async () => {
            const err = new Error("Database cluster metric readout failure");
            mockService.getOverview.mockRejectedValue(err);

            await controller.getOverview(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminSettings.getOverview");
        });
    });

    describe("changePassword Endpoint", () => {
        it("should modify configuration credential string sets securely", async () => {
            const mockResult = { success: true, message: "Password updated successfully" };
            mockService.changePassword.mockResolvedValue(mockResult);

            await controller.changePassword(req, res);

            expect(mockService.changePassword).toHaveBeenCalledWith(
                "admin_root_001",
                "old_password_123",
                "new_secure_password_789"
            );
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should catch credential modification faults and forward to handleError", async () => {
            const err = new Error("Current credential verification failure mismatch");
            mockService.changePassword.mockRejectedValue(err);

            await controller.changePassword(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminSettings.changePassword");
        });
    });

    describe("addAdmin Endpoint", () => {
        it("should provision fresh dynamic operational roles and emit 201 parameters status maps", async () => {
            const mockCreatedAdmin = { id: "adm_002", name: "Super Admin", email: "super@admin.com" };
            mockService.addAdmin.mockResolvedValue(mockCreatedAdmin);

            await controller.addAdmin(req, res);

            expect(mockService.addAdmin).toHaveBeenCalledWith("Super Admin", "super@admin.com");
            expect(created).toHaveBeenCalledWith(res, mockCreatedAdmin);
        });

        it("should catch validation collisions duplicates and send straight to handleError", async () => {
            const err = new Error("Target administrator email identifier already registered");
            mockService.addAdmin.mockRejectedValue(err);

            await controller.addAdmin(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminSettings.addAdmin");
        });
    });

    describe("getCommission Endpoint", () => {
        it("should fetch active operational processing configurations rate attributes maps successfully", async () => {
            const mockRateConfig = { commissionRate: 10 };
            mockService.getCommission.mockResolvedValue(mockRateConfig);

            await controller.getCommission(req, res);

            expect(mockService.getCommission).toHaveBeenCalledWith("admin_root_001");
            expect(ok).toHaveBeenCalledWith(res, mockRateConfig);
        });

        it("should route configuration setup read locks faults down to handleError middleware", async () => {
            const err = new Error("Cluster settings collection read fault");
            mockService.getCommission.mockRejectedValue(err);

            await controller.getCommission(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminSettings.getCommission");
        });
    });

    describe("updateCommission Endpoint", () => {
        it("should update dynamic financial system aggregation variables cleanly", async () => {
            const mockUpdatedConfig = { commissionRate: 15, updated: true };
            mockService.updateCommission.mockResolvedValue(mockUpdatedConfig);

            await controller.updateCommission(req, res);

            expect(mockService.updateCommission).toHaveBeenCalledWith("admin_root_001", 15);
            expect(ok).toHaveBeenCalledWith(res, mockUpdatedConfig);
        });

        it("should catch transaction modifications deadlocks and pass context down to handleError", async () => {
            const err = new Error("Write constraint block on configuration cluster variables");
            mockService.updateCommission.mockRejectedValue(err);

            await controller.updateCommission(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminSettings.updateCommission");
        });
    });
});