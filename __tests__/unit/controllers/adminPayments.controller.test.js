/**
 * @fileoverview Unit tests for Admin Payments Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createAdminPaymentsController = require("../../../controllers/admin/adminPayments.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Admin Payments Controller (100% Comprehensive Coverage Blueprint)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            fetchPaymentStats: jest.fn(),
            fetchRevenueChart: jest.fn(),
            fetchTransactions: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createAdminPaymentsController(mockService, { logger: mockLogger });

        req = {
            query: { page: "2", limit: "15", search: "  Alex  ", type: "escrow_payout" },
            admin: { _id: "admin_fin_777" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("getPaymentStats Endpoint", () => {
        it("should retrieve overall payment statistics metrics successfully", async () => {
            const mockStats = { totalRevenue: 15000, activeEscrows: 500 };
            mockService.fetchPaymentStats.mockResolvedValue(mockStats);

            await controller.getPaymentStats(req, res);

            expect(mockService.fetchPaymentStats).toHaveBeenCalledWith("admin_fin_777");
            expect(ok).toHaveBeenCalledWith(res, mockStats);
        });

        it("should forward statistics fetching exceptions directly down to handleError", async () => {
            const err = new Error("Database cluster aggregation timeout");
            mockService.fetchPaymentStats.mockRejectedValue(err);

            await controller.getPaymentStats(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminPayments.getPaymentStats");
        });
    });

    describe("getRevenueChart Endpoint", () => {
        it("should retrieve chronological charting metrics successfully", async () => {
            const mockChart = { data: [100, 200, 300] };
            mockService.fetchRevenueChart.mockResolvedValue(mockChart);

            await controller.getRevenueChart(req, res);

            expect(mockService.fetchRevenueChart).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledWith(res, mockChart);
        });

        it("should route calculation charting path errors straight to handleError", async () => {
            const err = new Error("Data transformation error matrix exception");
            mockService.fetchRevenueChart.mockRejectedValue(err);

            await controller.getRevenueChart(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminPayments.getRevenueChart");
        });
    });

    describe("getTransactions Endpoint", () => {
        it("should parse and explicitly leverage valid explicit query specifications fields parameters", async () => {
            const mockData = { rows: [], total: 0 };
            mockService.fetchTransactions.mockResolvedValue(mockData);

            await controller.getTransactions(req, res);

            expect(mockService.fetchTransactions).toHaveBeenCalledWith({
                page: 2,
                limit: 15,
                search: "Alex",
                type: "escrow_payout"
            });
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should gracefully trigger all fallback parameters filters when queries fields are omitted or negative", async () => {
            req.query = { page: "-5", limit: "50", search: undefined, type: undefined };
            const mockData = { rows: [], total: 0 };
            mockService.fetchTransactions.mockResolvedValue(mockData);

            await controller.getTransactions(req, res);

            expect(mockService.fetchTransactions).toHaveBeenCalledWith({
                page: 1,
                limit: 20,
                search: "",
                type: ""
            });
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should evaluate logical OR fallbacks when page and limit are string-based NaN unparseable values", async () => {
            // CONDITION COVERAGE GAPS FILLED: Number.parseInt(x) evaluates to NaN, forcing fallback execution branches
            req.query = { page: "not-a-number", limit: "abc", search: "   ", type: "  " };
            const mockData = { rows: [], total: 0 };
            mockService.fetchTransactions.mockResolvedValue(mockData);

            await controller.getTransactions(req, res);

            expect(mockService.fetchTransactions).toHaveBeenCalledWith({
                page: 1,      // Handled NaN || 1 branch
                limit: 10,     // Handled NaN || 10 branch
                search: "",    // Handled purely whitespaced string trim fallback branch
                type: ""       // Handled purely whitespaced string trim fallback branch
            });
        });

        it("should handle error in getTransactions path", async () => {
            const err = new Error("Transaction registry cluster offline");
            mockService.fetchTransactions.mockRejectedValue(err);

            await controller.getTransactions(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "adminPayments.getTransactions");
        });
    });
});