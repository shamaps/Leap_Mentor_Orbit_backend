/**
 * @fileoverview Unit tests for Admin Payments Domain Service.
 * Fakes all system data layers to isolate calculation structures.
 */

const createAdminPaymentsService = require("../../../services/adminPayments.service");

describe("Admin Payments Service", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findAdminCommissionRate: jest.fn(),
            findCompletedPaidSessions: jest.fn(),
            sumAllWalletEscrows: jest.fn(),
            countRefundedRequests: jest.fn(),
            findCompletedSessionsSince: jest.fn(),
            findUserIdsByName: jest.fn(),
            countTransactions: jest.fn(),
            findTransactions: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createAdminPaymentsService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("fetchPaymentStats", () => {
        it("should aggregate completed session sums and use explicit admin commission override keys", async () => {
            mockRepo.findAdminCommissionRate.mockResolvedValue({ commissionRate: 15 });
            mockRepo.findCompletedPaidSessions.mockResolvedValue([
                { totalAmount: 100, commissionAmount: 15 },
                { totalAmount: 200, commissionAmount: 30 },
            ]);
            mockRepo.sumAllWalletEscrows.mockResolvedValue([{ total: 350 }]);
            mockRepo.countRefundedRequests.mockResolvedValue(5);

            const result = await service.fetchPaymentStats("admin_123");

            expect(result).toEqual({
                totalRevenue: 300,
                platformCommission: 45,
                commissionRate: 15,
                pendingPayouts: 350,
                refundedRequests: 5,
            });
        });

        it("should fall back gracefully to default system constants if admin profile doesn't override commissionRate", async () => {
            mockRepo.findAdminCommissionRate.mockResolvedValue(null);
            mockRepo.findCompletedPaidSessions.mockResolvedValue([]);
            mockRepo.sumAllWalletEscrows.mockResolvedValue([]);
            mockRepo.countRefundedRequests.mockResolvedValue(0);

            const result = await service.fetchPaymentStats("admin_123");
            expect(result.commissionRate).toBeDefined(); // Matches system default constant behavior configuration
        });
    });

    describe("fetchRevenueChart", () => {
        it("should execute single database fetch pass and group elements safely into a 6-month array pass", async () => {
            const currentYear = new Date().getFullYear();
            const currentMonth = new Date().getMonth();

            mockRepo.findCompletedSessionsSince.mockResolvedValue([
                { completedAt: new Date(currentYear, currentMonth, 15), totalAmount: 150 },
                { completedAt: new Date(currentYear, currentMonth, 20), totalAmount: 50 },
            ]);

            const chart = await service.fetchRevenueChart();

            expect(chart).toBeInstanceOf(Array);
            expect(chart).toHaveLength(6);
            // Last element corresponds to the current month bucket evaluation logic pass
            expect(chart[5].amount).toBe(200);
        });
    });

    describe("fetchTransactions", () => {
        it("should mask welcome bonus transactions if query context parameters are unpopulated", async () => {
            mockRepo.countTransactions.mockResolvedValue(1);
            mockRepo.findTransactions.mockResolvedValue([
                {
                    _id: "60c72b2f9b1d8b2bad684001",
                    amount: 500,
                    type: "withdrawal",
                    description: "Stripe secure payout",
                    createdAt: "2026-06-15T12:00:00.000Z",
                    user: { name: "Jane Doe", email: "jane@test.com" },
                },
            ]);

            const result = await service.fetchTransactions({ page: 1, limit: 10 });

            expect(mockRepo.findTransactions).toHaveBeenCalledWith({ type: { $ne: "credit" } }, 0, 10);
            expect(result.transactions[0].status).toBe("pending");
            expect(result.transactions[0].txId).toBe("#TRX-84001");
        });

        it("should look up matching human indices dynamically if text search terms are provided", async () => {
            mockRepo.findUserIdsByName.mockResolvedValue(["u_1", "u_2"]);
            mockRepo.countTransactions.mockResolvedValue(0);
            mockRepo.findTransactions.mockResolvedValue([]);

            await service.fetchTransactions({ page: 1, limit: 10, search: "John", type: "escrow_refund" });

            expect(mockRepo.findUserIdsByName).toHaveBeenCalledWith("John");
            expect(mockRepo.findTransactions).toHaveBeenCalledWith(
                { user: { $in: ["u_1", "u_2"] }, type: "escrow_refund" },
                0,
                10
            );
        });
    });
});