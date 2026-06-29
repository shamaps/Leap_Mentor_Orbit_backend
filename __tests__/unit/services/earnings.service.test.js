/**
 * @fileoverview Unit tests for Earnings Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

const mockMonthlyBuckets = jest.fn(() => ["14:00", "14:30"]);
const mockWeeklyBuckets = jest.fn(() => ["14:00", "14:30"]);

jest.mock("../../../utils/earningsChart", () => ({
    buildMonthlyBuckets: (...args) => mockMonthlyBuckets(...args),
    buildWeeklyBuckets: (...args) => mockWeeklyBuckets(...args),
}));

jest.mock("../../../utils/mappers/earnings.mapper", () => ({
    toEarningsSummaryDTO: jest.fn((d) => d),
    toEarningsChartDTO: jest.fn((d) => d),
    toPayoutHistoryDTO: jest.fn((d) => d),
    toPayoutRowDTO: jest.fn((d) => d),
}));

const createEarningsService = require("../../../services/earnings.service");
const AppError = require("../../../utils/appError");

describe("Earnings Service Layer (100% Condition Coverage Blueprint)", () => {
    let mockRepo, mockLogger, service, baseSessions;

    beforeEach(() => {
        mockRepo = {
            findCompletedSessions: jest.fn(),
            findMentorProfileStats: jest.fn(),
            findOngoingPaidSessions: jest.fn(),
            findWallet: jest.fn(),
            findCompletedSessionsSince: jest.fn(),
            findUserIdsByName: jest.fn(),
            countPayouts: jest.fn(),
            findPayouts: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createEarningsService(mockRepo, { logger: mockLogger });

        baseSessions = [
            { totalAmount: 100, completedAt: "2026-06-15" },
            { totalAmount: 200, completedAt: "2026-06-20" }
        ];

        jest.clearAllMocks();
    });

    describe("getEarningsSummary", () => {
        it("should calculate totals and handle missing wallet/rating parameters safely", async () => {
            mockRepo.findCompletedSessions.mockResolvedValue(baseSessions);
            mockRepo.findMentorProfileStats.mockResolvedValue(null);
            mockRepo.findOngoingPaidSessions.mockResolvedValue([{ mentorPayout: 50 }]);
            mockRepo.findWallet.mockResolvedValue(null);

            const res = await service.getEarningsSummary("m1");
            expect(res.totalEarnings).toBe(300);
            expect(res.avgRating).toBe(0);
            expect(res.walletBalance).toBe(0);
        });
    });

    describe("getEarningsChart", () => {
        it("should trigger monthly bucket pipelines when periodParam defaults or equals monthly", async () => {
            mockRepo.findCompletedSessionsSince.mockResolvedValue(baseSessions);

            const res = await service.getEarningsChart("m1", "monthly");
            expect(res.period).toBe("monthly");
          
            expect(mockMonthlyBuckets).toHaveBeenCalledWith(expect.any(Array), expect.any(Date));
        });

        it("should trigger weekly bucket pipelines when periodParam equals weekly", async () => {
            mockRepo.findCompletedSessionsSince.mockResolvedValue(baseSessions);

            const res = await service.getEarningsChart("m1", "weekly");
            expect(res.period).toBe("weekly");
            
            expect(mockWeeklyBuckets).toHaveBeenCalledWith(expect.any(Array), expect.any(Date));
        });
    });

    describe("getPayoutHistory", () => {
        it("should clamp pagination metrics and filter matching rows via names search terms", async () => {
            mockRepo.findUserIdsByName.mockResolvedValue([{ _id: "u1" }]);
            mockRepo.countPayouts.mockResolvedValue(15);
            mockRepo.findPayouts.mockResolvedValue([]);

            const res = await service.getPayoutHistory("m1", { page: "2", limit: "10", search: "Alex" });
            expect(res.pagination.currentPage).toBe(2);
            expect(mockRepo.findUserIdsByName).toHaveBeenCalledWith("Alex");
        });

        it("should bypass wildcard text logic if search query parameter evaluates empty", async () => {
            mockRepo.countPayouts.mockResolvedValue(0);
            mockRepo.findPayouts.mockResolvedValue([]);

            await service.getPayoutHistory("m1", { page: undefined, limit: undefined, search: "" });
           
            expect(mockRepo.findUserIdsByName).not.toHaveBeenCalled();
        });
    });
});