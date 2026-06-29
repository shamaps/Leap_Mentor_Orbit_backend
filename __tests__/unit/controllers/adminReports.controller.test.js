/**
 * @fileoverview Unit tests for Admin Reports Controller.
 * Validates request binding bounds, query clamp limits, and payload parsing.
 */

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    noContent: jest.fn((res) => res.status(204).send()),
    unprocessable: jest.fn((res, message) => res.status(422).json({ success: false, error: message })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createAdminReportsController = require("../../../controllers/admin/adminReports.controller");
const { ok, noContent, unprocessable } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Admin Reports Controller", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            fetchReportStats: jest.fn(),
            fetchReports: jest.fn(),
            handleReport: jest.fn(),
            processRefund: jest.fn(),
            deleteSession: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createAdminReportsController(mockService, { logger: mockLogger });

        req = { admin: { _id: "admin_user_99" }, query: {}, params: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getReportStats", () => {
        it("should successfully retrieve report metrics overview", async () => {
            const mockStats = { totalReports: 10, pendingResolution: 3, resolvedToday: 2 };
            mockService.fetchReportStats.mockResolvedValue(mockStats);

            await controller.getReportStats(req, res);

            expect(mockService.fetchReportStats).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledWith(res, mockStats);
        });

        it("should catch errors via the global app error handler utility", async () => {
            const testError = new Error("Database gridlock");
            mockService.fetchReportStats.mockRejectedValue(testError);

            await controller.getReportStats(req, res);

            expect(handleError).toHaveBeenCalledWith(res, testError, "getReportStats");
        });
    });

    describe("getReports", () => {
        it("should sanitize search keywords and clamp pagination query parameters cleanly", async () => {
            req.query = { page: "abc", limit: "99", search: "  Spam ", status: "open" };
            mockService.fetchReports.mockResolvedValue({ reports: [], pagination: {} });

            await controller.getReports(req, res);

            expect(mockService.fetchReports).toHaveBeenCalledWith({
                page: 1,
                limit: 20,
                search: "Spam",
                status: "open",
            });
        });
    });

    describe("handleReport", () => {
        it("should reject invalid status options with an unprocessable payload envelope", async () => {
            req.body = { status: "pending", adminNote: "Hold" };

            await controller.handleReport(req, res);

            expect(unprocessable).toHaveBeenCalledWith(res, "Status must be resolved or dismissed.");
            expect(mockService.handleReport).not.toHaveBeenCalled();
        });

        it("should delegate execution values to the domain service on valid status inputs", async () => {
            req.params.id = "rep_123";
            req.body = { status: "resolved", adminNote: "Closed gracefully" };
            mockService.handleReport.mockResolvedValue({ id: "rep_123", status: "resolved" });

            await controller.handleReport(req, res);

            expect(mockService.handleReport).toHaveBeenCalledWith({
                reportId: "rep_123",
                status: "resolved",
                adminNote: "Closed gracefully",
                adminId: "admin_user_99",
            });
            expect(ok).toHaveBeenCalled();
        });
    });

    describe("processRefund", () => {
        it("should successfully process financial ledger wallet refunds", async () => {
            req.params.id = "rep_123";
            req.body = { adminNote: "Legitimate fraud claim" };
            mockService.processRefund.mockResolvedValue({ refundAmount: 100 });

            await controller.processRefund(req, res);

            expect(mockService.processRefund).toHaveBeenCalledWith({
                reportId: "rep_123",
                adminNote: "Legitimate fraud claim",
                adminId: "admin_user_99",
            });
            expect(ok).toHaveBeenCalledWith(res, {
                message: "Refund of 100 tokens processed successfully.",
                refundAmount: 100,
            });
        });
    });

    describe("deleteSession", () => {
        it("should tear down connect requests and emit a no content response code", async () => {
            req.params.id = "rep_123";
            req.body = { adminNote: "Terms of service breach" };
            mockService.deleteSession.mockResolvedValue();

            await controller.deleteSession(req, res);

            expect(mockService.deleteSession).toHaveBeenCalledWith({
                reportId: "rep_123",
                adminNote: "Terms of service breach",
                adminId: "admin_user_99",
            });
            expect(noContent).toHaveBeenCalledWith(res);
        });
    });
});