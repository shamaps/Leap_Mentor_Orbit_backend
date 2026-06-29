jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createEarningsController = require("../../../controllers/earnings.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Earnings Controller (Unit)", () => {
    let mockEarningsService, mockWithdrawalService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockEarningsService = {
            getEarningsSummary: jest.fn(),
            getEarningsChart: jest.fn(),
            getPayoutHistory: jest.fn(),
        };
        mockWithdrawalService = {
            withdrawEarnings: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createEarningsController(mockEarningsService, mockWithdrawalService, { logger: mockLogger });

        req = { user: { _id: "mentor_123" }, query: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getEarningsSummary", () => {
        it("should successfully request summary metrics map and return response", async () => {
            const mockSummary = { totalEarnings: 1000, walletBalance: 200 };
            mockEarningsService.getEarningsSummary.mockResolvedValue(mockSummary);

            await controller.getEarningsSummary(req, res);

            expect(mockEarningsService.getEarningsSummary).toHaveBeenCalledWith("mentor_123");
            expect(ok).toHaveBeenCalledWith(res, mockSummary);
        });

        it("should redirect thrown errors directly into global application error utility blocks", async () => {
            const error = new Error("Database drop");
            mockEarningsService.getEarningsSummary.mockRejectedValue(error);

            await controller.getEarningsSummary(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "earnings.getEarningsSummary");
        });
    });

    describe("getEarningsChart", () => {
        it("should forward structural query time filters to downstream services", async () => {
            req.query.period = "weekly";
            mockEarningsService.getEarningsChart.mockResolvedValue({ period: "weekly", data: [] });

            await controller.getEarningsChart(req, res);

            expect(mockEarningsService.getEarningsChart).toHaveBeenCalledWith("mentor_123", "weekly");
        });
    });

    describe("withdrawEarnings", () => {
        it("should call the wallet withdrawal service and issue token clearance confirmations", async () => {
            const successPayload = { success: true, cashout: 150 };
            mockWithdrawalService.withdrawEarnings.mockResolvedValue(successPayload);

            await controller.withdrawEarnings(req, res);

            expect(mockWithdrawalService.withdrawEarnings).toHaveBeenCalledWith("mentor_123");
            expect(ok).toHaveBeenCalledWith(res, successPayload);
        });
    });
});