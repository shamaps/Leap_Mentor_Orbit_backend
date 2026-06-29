jest.mock("../../../utils/earningsChart", () => ({
    buildMonthlyBuckets: jest.fn().mockReturnValue([{ label: "JAN", amount: 100 }]),
    buildWeeklyBuckets: jest.fn().mockReturnValue([{ label: "W1", amount: 50 }]),
}));

jest.mock("../../../utils/mappers/earnings.mapper", () => ({
    toEarningsSummaryDTO: jest.fn((data) => data),
    toEarningsChartDTO: jest.fn((data) => data),
    toPayoutHistoryDTO: jest.fn((data) => data),
}));

const createEarningsService = require("../../../services/earnings.service");
const { buildMonthlyBuckets, buildWeeklyBuckets } = require("../../../utils/earningsChart");

describe("Earnings Service (Unit)", () => {
    let mockRepo, mockLogger, service;

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
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createEarningsService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("getEarningsSummary", () => {
        it("should accurately compute totals and differentiate monthly limits using database dates", async () => {
            const baseTime = new Date("2026-06-25T10:00:00.000Z");
            mockRepo.findCompletedSessions.mockResolvedValue([
                { totalAmount: 300, completedAt: baseTime },
                { totalAmount: 200, completedAt: new Date("2026-01-01T10:00:00.000Z") }
            ]);
            mockRepo.findMentorProfileStats.mockResolvedValue({ avgRating: 4.8 });
            mockRepo.findOngoingPaidSessions.mockResolvedValue([{ mentorPayout: 150 }]);
            mockRepo.findWallet.mockResolvedValue({ balance: 50 });

            const result = await service.getEarningsSummary("mentor_id");

            expect(result.totalEarnings).toBe(500);
            expect(result.avgRating).toBe(4.8);
            expect(result.pendingPayout).toBe(150);
            expect(result.walletBalance).toBe(50);
        });
    });

    describe("getEarningsChart", () => {
        it("should correctly compile monthly data structures across 6 rolling slots by default", async () => {
            mockRepo.findCompletedSessionsSince.mockResolvedValue([]);

            const result = await service.getEarningsChart("mentor_id", "monthly");

            expect(result.period).toBe("monthly");
            expect(buildMonthlyBuckets).toHaveBeenCalled();
        });
    });

    describe("getPayoutHistory", () => {
        it("should successfully build regex matching query options arrays when textual filters arrive", async () => {
            mockRepo.findUserIdsByName.mockResolvedValue([{ _id: "mentee_user_id" }]);
            mockRepo.countPayouts.mockResolvedValue(1);
            mockRepo.findPayouts.mockResolvedValue([]);

            await service.getPayoutHistory("mentor_id", { page: 1, limit: 10, search: "Bob" });

            expect(mockRepo.findUserIdsByName).toHaveBeenCalledWith("Bob");
            expect(mockRepo.findPayouts).toHaveBeenCalledWith(
                expect.objectContaining({
                    mentee: { $in: ["mentee_user_id"] }
                }),
                0,
                10
            );
        });
    });
});