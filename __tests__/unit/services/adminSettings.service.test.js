/**
 * @fileoverview Unit tests for Admin Settings Domain Service.
 * Safely mocks the internal repository architecture and cache state.
 */

jest.mock("../../../utils/cache", () => ({
    NS: { PLATFORM_SETTINGS: "ps", COMMISSION: "comm" },
    TTL: { PLATFORM_SETTINGS: 60, COMMISSION: 60 },
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
}));

const createAdminSettingsService = require("../../../services/adminSettings.service");
const cache = require("../../../utils/cache");
const AppError = require("../../../utils/appError");

describe("Admin Settings Service", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            countTotalUsers: jest.fn(),
            countActiveSessions: jest.fn(),
            findAdminDocumentById: jest.fn(),
            findAdminCommissionById: jest.fn(),
            findAdminByEmail: jest.fn(),
            createAdmin: jest.fn(),
            updateCommissionRate: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createAdminSettingsService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("getOverview", () => {
        it("should return the cached block directly if hits are found inside memory records", async () => {
            cache.get.mockResolvedValue({ totalUsers: 100, activeSessions: 10 });

            const result = await service.getOverview();

            expect(result).toEqual({ totalUsers: 100, activeSessions: 10 });
            expect(mockRepo.countTotalUsers).not.toHaveBeenCalled();
        });

        it("should drop through into repo aggregations and commit payload values to cache on misses", async () => {
            cache.get.mockResolvedValue(null);
            mockRepo.countTotalUsers.mockResolvedValue(500);
            mockRepo.countActiveSessions.mockResolvedValue(25);

            const result = await service.getOverview();

            expect(result).toEqual({ totalUsers: 500, activeSessions: 25 });
            expect(cache.set).toHaveBeenCalledWith(cache.NS.PLATFORM_SETTINGS, result, cache.TTL.PLATFORM_SETTINGS);
        });
    });

    describe("changePassword", () => {
        it("should throw AppError 400 if currentPassword is identical to newPassword", async () => {
            await expect(service.changePassword("admin1", "samepass", "samepass"))
                .rejects.toMatchObject({ status: 400, message: "New password must be different." });
        });

        it("should validate current state against the document model schema method and write updates on matching pairs", async () => {
            const mockAdminDoc = {
                comparePassword: jest.fn().mockResolvedValue(true),
                password: "old",
                save: jest.fn().mockResolvedValue(true),
            };
            mockRepo.findAdminDocumentById.mockResolvedValue(mockAdminDoc);

            const response = await service.changePassword("admin1", "old_pass", "secure_new_pass");

            expect(mockAdminDoc.comparePassword).toHaveBeenCalledWith("old_pass");
            expect(mockAdminDoc.password).toBe("secure_new_pass");
            expect(mockAdminDoc.save).toHaveBeenCalled();
            expect(response.message).toContain("successfully");
        });
    });

    describe("addAdmin", () => {
        it("should prevent duplicate registration by throwing 409 indices error messages on existing targets", async () => {
            mockRepo.findAdminByEmail.mockResolvedValue({ _id: "exists" });

            await expect(service.addAdmin("Jane", "jane@leapmentor.com"))
                .rejects.toMatchObject({ status: 409, message: /already exists/ });
        });
    });

    describe("updateCommission", () => {
        it("should invalidate the targeted user cache profile indices after database execution commits", async () => {
            mockRepo.updateCommissionRate.mockResolvedValue(true);

            const res = await service.updateCommission("admin_id_1", "12.5");

            expect(mockRepo.updateCommissionRate).toHaveBeenCalledWith("admin_id_1", 12.5);
            expect(cache.del).toHaveBeenCalledWith(`${cache.NS.COMMISSION}:admin_id_1`);
            expect(res.commissionRate).toBe(12.5);
        });
    });
});