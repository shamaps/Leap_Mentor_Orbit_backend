/**
 * @fileoverview Unit tests for Admin Payments Controller.
 */

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

// FIXED: Corrected path traversal depth from 4 step-backs down to 3 step-backs
const createAdminPaymentsController = require("../../../controllers/admin/adminPayments.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Admin Payments Controller", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            fetchPaymentStats: jest.fn(),
            fetchRevenueChart: jest.fn(),
            fetchTransactions: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createAdminPaymentsController(mockService, { logger: mockLogger });

        req = { admin: { _id: "admin_123" }, query: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getPaymentStats", () => {
        it("should extract admin ID from request context and return payload envelope", async () => {
            const mockStats = { totalRevenue: 5000, platformCommission: 500 };
            mockService.fetchPaymentStats.mockResolvedValue(mockStats);

            await controller.getPaymentStats(req, res);

            expect(mockService.fetchPaymentStats).toHaveBeenCalledWith("admin_123");
            expect(ok).toHaveBeenCalledWith(res, mockStats);
        });
    });

    describe("getRevenueChart", () => {
        it("should fetch mapped monthly chart array structure", async () => {
            const mockChart = [{ label: "JAN", amount: 1000 }];
            mockService.fetchRevenueChart.mockResolvedValue(mockChart);

            await controller.getRevenueChart(req, res);

            expect(ok).toHaveBeenCalledWith(res, mockChart);
        });
    });

    describe("getTransactions", () => {
        it("should parse and validate query pagination limits before service delegation", async () => {
            req.query = { page: "2", limit: "50", search: "  John ", type: "withdrawal" };
            mockService.fetchTransactions.mockResolvedValue({ transactions: [], pagination: {} });

            await controller.getTransactions(req, res);

            expect(mockService.fetchTransactions).toHaveBeenCalledWith({
                page: 2,
                limit: 20,
                search: "John",
                type: "withdrawal",
            });
        });
    });
});