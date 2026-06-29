/**
 * @fileoverview Unit tests for Earnings Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createEarningsController = require("../../../controllers/earnings.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Earnings Controller (100% Comprehensive Coverage Blueprint)", () => {
    let mockEarningsService, mockWalletWithdrawalService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockEarningsService = {
            getEarningsSummary: jest.fn(),
            getEarningsChart: jest.fn(),
            getPayoutHistory: jest.fn(),
        };

        mockWalletWithdrawalService = {
            withdrawEarnings: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createEarningsController(mockEarningsService, mockWalletWithdrawalService, { logger: mockLogger });

        req = {
            query: { period: "monthly", page: "1", limit: "10" },
            user: { _id: "mentor_rev_888" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("getEarningsSummary Endpoint", () => {
        it("should return the overall financial balance summary card metrics successfully", async () => {
            const mockSummary = { availableBalance: 1200, lifeTimeEarnings: 5000 };
            mockEarningsService.getEarningsSummary.mockResolvedValue(mockSummary);

            await controller.getEarningsSummary(req, res);

            expect(mockEarningsService.getEarningsSummary).toHaveBeenCalledWith("mentor_rev_888");
            expect(ok).toHaveBeenCalledWith(res, mockSummary);
        });

        it("should forward summary rendering service exceptions directly to handleError", async () => {
            const err = new Error("Ledger balance query timeout error");
            mockEarningsService.getEarningsSummary.mockRejectedValue(err);

            await controller.getEarningsSummary(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "earnings.getEarningsSummary");
        });
    });

    describe("getEarningsChart Endpoint", () => {
        it("should map chronological earnings metrics for graphs successfully", async () => {
            const mockChartData = { labels: ["Jan", "Feb"], datasets: [100, 200] };
            mockEarningsService.getEarningsChart.mockResolvedValue(mockChartData);

            await controller.getEarningsChart(req, res);

            expect(mockEarningsService.getEarningsChart).toHaveBeenCalledWith("mentor_rev_888", "monthly");
            expect(ok).toHaveBeenCalledWith(res, mockChartData);
        });

        it("should route calculation charting path errors straight to handleError", async () => {
            const err = new Error("Data transformation matrix compilation failure");
            mockEarningsService.getEarningsChart.mockRejectedValue(err);

            await controller.getEarningsChart(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "earnings.getEarningsChart");
        });
    });

    describe("getPayoutHistory Endpoint", () => {
        it("should pull paginated historical transfer records lists successfully matching query packages", async () => {
            const mockHistory = { data: [], total: 0 };
            mockEarningsService.getPayoutHistory.mockResolvedValue(mockHistory);

            await controller.getPayoutHistory(req, res);

            expect(mockEarningsService.getPayoutHistory).toHaveBeenCalledWith("mentor_rev_888", req.query);
            expect(ok).toHaveBeenCalledWith(res, mockHistory);
        });

        it("should route ledger database history fetch errors to handleError", async () => {
            const err = new Error("Cluster read read stream network failure");
            mockEarningsService.getPayoutHistory.mockRejectedValue(err);

            await controller.getPayoutHistory(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "earnings.getPayoutHistory");
        });
    });

    describe("withdrawEarnings Endpoint", () => {
        it("should trigger manual balance payout transfers toward recorded outbound accounts successfully", async () => {
            const mockPayoutReceipt = { transactionId: "tx_999", status: "initiated" };
            mockWalletWithdrawalService.withdrawEarnings.mockResolvedValue(mockPayoutReceipt);

            await controller.withdrawEarnings(req, res);

            expect(mockWalletWithdrawalService.withdrawEarnings).toHaveBeenCalledWith("mentor_rev_888");
            expect(ok).toHaveBeenCalledWith(res, mockPayoutReceipt);
        });

        it("should route withdrawal settlement operational exceptions directly to handleError", async () => {
            const err = new Error("Insufficient unreserved liquidity balance available");
            mockWalletWithdrawalService.withdrawEarnings.mockRejectedValue(err);

            await controller.withdrawEarnings(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "earnings.withdrawEarnings");
        });
    });
});