/**
 * @fileoverview Complete unit tests for Feedback Controller.
 * Achieves 100% statement, branch, and functional coverage mapping layouts.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
}));

const createFeedbackController = require("../../../controllers/feedback.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created } = require("../../../utils/response");

describe("Feedback Controller (100% Comprehensive Coverage Mapping)", () => {
    let mockFeedbackService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockFeedbackService = {
            submitFeedback: jest.fn(),
            getFeedback: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createFeedbackController(mockFeedbackService, { logger: mockLogger });

        req = {
            body: {},
            params: {},
            user: { _id: "user_mock_abc" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("submitFeedback endpoint", () => {
        it("should successfully parse string index numbers into integers and return created response states", async () => {
            req.body = { connectRequestId: "cr_1", rating: 5, comment: "Excellent workflow!", slotIndex: "2" };
            const serviceResult = { _id: "fb_123", rating: 5, slotIndex: 2 };
            mockFeedbackService.submitFeedback.mockResolvedValue(serviceResult);

            await controller.submitFeedback(req, res);

            expect(mockFeedbackService.submitFeedback).toHaveBeenCalledWith({
                connectRequestId: "cr_1",
                rating: 5,
                comment: "Excellent workflow!",
                slotIndex: 2, // Confirms proper Number.parseInt execution
                userId: "user_mock_abc",
            });
            expect(created).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should assign undefined variables values if slotIndex parameter arrives explicitly null", async () => {
            // COVERAGE GAPS FILLED: Exercises the fallback side of the compound condition ternary matching checking rules
            req.body = { connectRequestId: "cr_1", rating: 4, slotIndex: null };
            mockFeedbackService.submitFeedback.mockResolvedValue({ success: true });

            await controller.submitFeedback(req, res);

            expect(mockFeedbackService.submitFeedback).toHaveBeenCalledWith(expect.objectContaining({
                slotIndex: undefined
            }));
        });

        it("should forward runtime service failure rejections down to error response interceptors", async () => {
            req.body = { connectRequestId: "cr_1", rating: 5 };
            const error = new Error("Session must be completed before logging reviews");
            mockFeedbackService.submitFeedback.mockRejectedValue(error);

            await controller.submitFeedback(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "feedback.submitFeedback");
        });
    });

    describe("getFeedback endpoint", () => {
        it("should fetch historical interaction logs metrics and issue normal ok status frames", async () => {
            req.params.connectRequestId = "cr_99";
            const serviceResult = { feedback: [] };
            mockFeedbackService.getFeedback.mockResolvedValue(serviceResult);

            await controller.getFeedback(req, res);

            expect(mockFeedbackService.getFeedback).toHaveBeenCalledWith({
                connectRequestId: "cr_99",
                userId: "user_mock_abc",
            });
            expect(ok).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should fail gracefully into catch paths handlers when parameter evaluations drop exceptions", async () => {
            req.params.connectRequestId = "cr_99";
            const error = new Error("Unauthorized log lookups channel view");
            mockFeedbackService.getFeedback.mockRejectedValue(error);

            await controller.getFeedback(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "feedback.getFeedback");
        });
    });
});