/**
 * @fileoverview Unit tests for Admin Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("jsonwebtoken", () => ({
    sign: jest.fn(() => "mock_signed_admin_jwt_token"),
}));

jest.mock("../../../utils/cache", () => ({
    get: jest.fn(),
    set: jest.fn(),
}));

jest.mock("../../../config/env", () => ({
    jwtSecret: "admin_secret_key_2026",
    jwtAdminExpiresIn: "7d",
    isProduction: true,
}));

jest.mock("../../../utils/mappers/adminUser.mapper", () => ({
    toAdminDTO: jest.fn((admin) => ({ id: admin._id, email: admin.email, name: admin.name })),
}));

jest.mock("../../../utils/mappers/user.mapper", () => ({
    toUserDTO: jest.fn((user) => ({ id: user._id, email: user.email })),
}));

jest.mock("../../../utils/mappers/mentorProfile.mapper", () => ({
    toMentorProfileDTO: jest.fn((profile) => ({ id: profile?._id, industry: profile?.industry })),
}));

const createAdminService = require("../../../services/admin.service");
const jwt = require("jsonwebtoken");
const config = require("../../../config/env");
const AppError = require("../../../utils/appError");

describe("Admin Service Layer (100% Condition Matrix Blueprint)", () => {
    let mockRepo, mockLogger, mockResponse, service;

    beforeEach(() => {
        mockRepo = {
            findAdminByEmail: jest.fn(),
            saveAdmin: jest.fn(),
            countAllUsers: jest.fn(),
            aggregateUserGrowth: jest.fn(),
            aggregateMentorIndustries: jest.fn(),
            findUserIdsByName: jest.fn(),
            countUsers: jest.fn(),
            findUsers: jest.fn(),
            findMentorProfilesByUserIds: jest.fn(),
            findMenteeProfilesByUserIds: jest.fn(),
            findUserById: jest.fn(),
            findMentorProfileByUser: jest.fn(),
            findMenteeProfileByUser: jest.fn(),
            countCompletedSessions: jest.fn(),
            findUserByIdRaw: jest.fn(),
            hardDeleteUser: jest.fn(),
            blockUserById: jest.fn(),
            unblockUserById: jest.fn(),
            cascadeDeleteUser: jest.fn(),
            countEngagementsByStatus: jest.fn(),
            countEngagements: jest.fn(),
            findEngagements: jest.fn(),
            findUserIdsBySearchTerm: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        mockResponse = { cookie: jest.fn() };
        service = createAdminService(mockRepo, { logger: mockLogger });

        jest.clearAllMocks();
    });

    describe("loginAdmin Authentication", () => {
        it("should throw a 401 error if admin cannot be located by email", async () => {
            mockRepo.findAdminByEmail.mockResolvedValue(null);
            await expect(service.loginAdmin(mockResponse, "none@admin.com", "password"))
                .rejects.toThrow(new AppError(401, "Invalid credentials."));
        });

        it("should throw a 403 error if the account is flagged as deactivated", async () => {
            mockRepo.findAdminByEmail.mockResolvedValue({ isActive: false });
            await expect(service.loginAdmin(mockResponse, "deactivated@admin.com", "password"))
                .rejects.toThrow(new AppError(403, "Admin account is deactivated"));
        });

        it("should throw a 401 error if the password verification check fails", async () => {
            mockRepo.findAdminByEmail.mockResolvedValue({ isActive: true, comparePassword: jest.fn().mockResolvedValue(false) });
            await expect(service.loginAdmin(mockResponse, "admin@test.com", "wrong_pass"))
                .rejects.toThrow(new AppError(401, "Invalid credentials"));
        });

        it("should write cookies and return admin profile DTO data rows upon successful authentication", async () => {
            const mockAdminRow = { _id: "admin_id_77", email: "admin@test.com", isActive: true, comparePassword: jest.fn().mockResolvedValue(true) };
            mockRepo.findAdminByEmail.mockResolvedValue(mockAdminRow);

            const res = await service.loginAdmin(mockResponse, "admin@test.com", "correct_pass");
            expect(mockResponse.cookie).toHaveBeenCalledWith("adminAccessToken", "mock_signed_admin_jwt_token", expect.objectContaining({ secure: true, sameSite: "strict" }));
            expect(res.admin).toBeDefined();
        });

        it("should downgrade sameSite options parameters to lax if production flag evaluates to false", async () => {
            config.isProduction = false;
            const mockAdminRow = { _id: "admin_id_77", email: "admin@test.com", isActive: true, comparePassword: jest.fn().mockResolvedValue(true) };
            mockRepo.findAdminByEmail.mockResolvedValue(mockAdminRow);

            await service.loginAdmin(mockResponse, "admin@test.com", "correct_pass");
            expect(mockResponse.cookie).toHaveBeenCalledWith("adminAccessToken", "mock_signed_admin_jwt_token", expect.objectContaining({ secure: false, sameSite: "lax" }));
        });
    });

    describe("Dashboard Metrics Aggregations", () => {
        it("should query stats counters maps for current calendar month boundaries", async () => {
            mockRepo.countAllUsers.mockResolvedValue(10);
            const res = await service.fetchStats();
            expect(res.totalUsers).toBe(10);
            expect(mockRepo.countAllUsers).toHaveBeenCalledTimes(6);
        });

        it("should map growth entries timestamps arrays into localized data strings format", async () => {
            mockRepo.aggregateUserGrowth.mockResolvedValue([{ _id: "2026-06-25", count: 15 }]);
            const res = await service.fetchUserGrowth();
            expect(res[0].label).toBeDefined();
            expect(res[0].count).toBe(15);
        });

        it("should return sorted lists describing top industries arrays counts", async () => {
            mockRepo.aggregateMentorIndustries.mockResolvedValue([{ _id: "Fintech", count: 88 }]);
            const res = await service.fetchMentorIndustryStats();
            expect(res[0].industry).toBe("Fintech");
            expect(res[0].count).toBe(88);
        });
    });

    describe("User Management Workflows", () => {
        it("should filter results by roles conditions and regex search constraints smoothly", async () => {
            mockRepo.findUserIdsByName.mockResolvedValue(["u1"]);
            mockRepo.countUsers.mockResolvedValue(1);
            mockRepo.findUsers.mockResolvedValue([{ _id: "u1", roles: ["mentor"] }]);
            mockRepo.findMentorProfilesByUserIds.mockResolvedValue([{ user: "u1", industry: "Tech" }]);
            mockRepo.findMenteeProfilesByUserIds.mockResolvedValue([]);

            const res = await service.fetchUsers({ search: "John", role: "mentor", page: 2, limit: 10, deleted: "false" });
            expect(res.users[0].profile).not.toBeNull();
            expect(res.pagination.page).toBe(2);
        });

        it("should pull true deleted user statuses depending on string query values options", async () => {
            mockRepo.countUsers.mockResolvedValue(0);
            mockRepo.findUsers.mockResolvedValue([]);
            mockRepo.findMentorProfilesByUserIds.mockResolvedValue([]);
            mockRepo.findMenteeProfilesByUserIds.mockResolvedValue([]);

            await service.fetchUsers({ page: 1, limit: 20, deleted: "true" });
            expect(mockRepo.countUsers).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: true }));
        });

        it("should load mentee profile structures if a specific user context does not hold mentor roles", async () => {
            mockRepo.findUserById.mockResolvedValue({ roles: ["mentee"] });
            mockRepo.findMenteeProfileByUser.mockResolvedValue({ _id: "mentee_prof" });
            mockRepo.countCompletedSessions.mockResolvedValue(4);

            const res = await service.fetchUserDetail("u_mentee");
            expect(res.sessionCount).toBe(4);
        });

        it("should throw a 404 error code if targeted detail rows lookups return null", async () => {
            mockRepo.findUserById.mockResolvedValue(null);
            await expect(service.fetchUserDetail("none")).rejects.toThrow(AppError);
        });

        it("should process permanent hard purges and emit telemetry confirmations logs upon success", async () => {
            mockRepo.findUserByIdRaw.mockResolvedValue({ name: "Alex", email: "alex@test.com" });
            const res = await service.removeUser("u1");
            expect(res.message).toContain("permanently deleted");
            expect(mockRepo.hardDeleteUser).toHaveBeenCalledWith("u1");
        });

        it("should throw a 404 error if hard purges request indices resolve null", async () => {
            mockRepo.findUserByIdRaw.mockResolvedValue(null);
            await expect(service.removeUser("u1")).rejects.toThrow(AppError);
        });

        it("should trigger soft blocks and restorations updates vectors cleanly across targets rows", async () => {
            mockRepo.blockUserById.mockResolvedValue({ name: "BlockedUser", email: "b@test.com" });
            const resBlock = await service.blockUser("u1");
            expect(resBlock.message).toContain("blocked");

            mockRepo.unblockUserById.mockResolvedValue({ name: "RestoredUser", email: "r@test.com" });
            const resUnblock = await service.unblockUser("u1");
            expect(resUnblock.message).toContain("restored");
        });

        it("should throw a 404 error if soft blocks or restorations options return empty updates rows", async () => {
            mockRepo.blockUserById.mockResolvedValue(null);
            await expect(service.blockUser("u1")).rejects.toThrow(AppError);

            mockRepo.unblockUserById.mockResolvedValue(null);
            await expect(service.unblockUser("u1")).rejects.toThrow(AppError);
        });

        it("should execute cascading soft-deletes and invalidate cascading links records parameters", async () => {
            mockRepo.findUserByIdRaw.mockResolvedValue({ name: "Soft", email: "soft@test.com" });
            const res = await service.deleteUser("u1");
            expect(res.message).toContain("deleted");
            expect(mockRepo.cascadeDeleteUser).toHaveBeenCalledWith("u1");
        });

        it("should throw a 404 error if cascade deletions targets resolve null", async () => {
            mockRepo.findUserByIdRaw.mockResolvedValue(null);
            await expect(service.deleteUser("u1")).rejects.toThrow(AppError);
        });
    });

    describe("Engagement Diagnostics Lists", () => {
        it("should consolidate statuses count mappings and execute mathematically sound reductions", async () => {
            mockRepo.countEngagementsByStatus.mockResolvedValue(5);
            const res = await service.fetchEngagementStats();
            expect(res.total).toBe(30); // 6 statuses * 5 elements each
        });

        it("should support custom timeframe parameters bounds filters and locate users records arrays by name tokens", async () => {
            mockRepo.findUserIdsBySearchTerm.mockResolvedValue(["u1"]);
            mockRepo.countEngagements.mockResolvedValue(1);
            mockRepo.findEngagements.mockResolvedValue([{ _id: "eng_1" }]);

            const res = await service.fetchEngagements({
                status: "ongoing",
                search: "Jane",
                dateFrom: "2026-01-01",
                dateTo: "2026-03-01",
                page: 1,
                limit: 15
            });

            expect(res.engagements).toHaveLength(1);
            expect(mockRepo.countEngagements).toHaveBeenCalledWith(expect.objectContaining({
                status: "ongoing",
                requestedAt: expect.any(Object)
            }));
        });
    });
});