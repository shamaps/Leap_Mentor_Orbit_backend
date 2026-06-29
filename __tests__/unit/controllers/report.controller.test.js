jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, ...data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createReportController = require("../../../controllers/report.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Report Controller (Unit)", () => {
    let mockReportService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockReportService = {
            submitReport: jest.fn(),
            getMyReport: jest.fn(),
            getAllReports: jest.fn(),
            updateReportStatus: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createReportController(mockReportService, { logger: mockLogger });

        req = { user: { _id: "user_reporter_123", name: "John Doe", email: "john@test.com" }, body: {}, params: {}, query: {}, file: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("submitReport", () => {
        it("should accept body structures, parse optional file screens, and return a standard 200 payload envelope", async () => {
            req.body = { connectRequestId: "session_001", complaintType: "no_show", description: "The mentor did not log into the session." };
            req.file = { originalname: "proof.png", buffer: Buffer.from("abc") };

            const serviceResult = { status: 201, body: { success: true, message: "Report submitted successfully." } };
            mockReportService.submitReport.mockResolvedValue(serviceResult);

            await controller.submitReport(req, res);

            expect(mockReportService.submitReport).toHaveBeenCalledWith({
                connectRequestId: "session_001",
                complaintType: "no_show",
                description: "The mentor did not log into the session.",
                reportedById: "user_reporter_123",
                file: req.file,
                user: req.user,
            });
            expect(ok).toHaveBeenCalledWith(res, serviceResult.body);
        });

        it("should bubble unexpected system exceptions safely to global application handlers", async () => {
            const error = new Error("Database network failure");
            mockReportService.submitReport.mockRejectedValue(error);

            await controller.submitReport(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "report.submitReport");
        });
    });

    describe("updateReportStatus", () => {
        it("should extract path parameters and delta status adjustments body fields smoothly", async () => {
            req.params.reportId = "report_777";
            req.body = { status: "resolved", adminNote: "Issue handled dynamically" };
            mockReportService.updateReportStatus.mockResolvedValue({ status: 200, body: { success: true } });

            await controller.updateReportStatus(req, res);

            expect(mockReportService.updateReportStatus).toHaveBeenCalledWith({
                reportId: "report_777",
                status: "resolved",
                adminNote: "Issue handled dynamically",
                userId: "user_reporter_123",
            });
        });
    });
});