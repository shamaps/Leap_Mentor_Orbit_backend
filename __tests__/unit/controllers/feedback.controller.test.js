jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createFeedbackController = require("../../../controllers/feedback.controller");
const { ok, created } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Feedback Controller (Unit)", () => {
    let mockFeedbackService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockFeedbackService = {
            submitFeedback: jest.fn(),
            getFeedback: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createFeedbackController(mockFeedbackService, { logger: mockLogger });

        req = { user: { _id: "user_mentee_789" }, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("submitFeedback", () => {
        it("should parse numeric slot parameters and issue a 201 created envelope on success", async () => {
            req.body = { connectRequestId: "req_666", rating: 5, comment: "Awesome", slotIndex: "2" };
            const serviceResult = { id: "feed_1", rating: 5 };
            mockFeedbackService.submitFeedback.mockResolvedValue(serviceResult);

            await controller.submitFeedback(req, res);

            expect(mockFeedbackService.submitFeedback).toHaveBeenCalledWith({
                connectRequestId: "req_666",
                rating: 5,
                comment: "Awesome",
                slotIndex: 2,
                userId: "user_mentee_789",
            });
            expect(created).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should correctly handle undefined slotIndex variables without failing parsing routines", async () => {
            req.body = { connectRequestId: "req_666", rating: 4 };

            await controller.submitFeedback(req, res);

            expect(mockFeedbackService.submitFeedback).toHaveBeenCalledWith({
                connectRequestId: "req_666",
                rating: 4,
                comment: undefined,
                slotIndex: undefined,
                userId: "user_mentee_789",
            });
        });

        it("should securely bubble execution errors to global handlers", async () => {
            const error = new Error("Invalid submission logic");
            mockFeedbackService.submitFeedback.mockRejectedValue(error);

            await controller.submitFeedback(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "feedback.submitFeedback");
        });
    });

    describe("getFeedback", () => {
        it("should capture parameter keys and return a structured 200 payload map", async () => {
            req.params.connectRequestId = "req_666";
            const payloadFixture = { myFeedback: {}, theirFeedback: null };
            mockFeedbackService.getFeedback.mockResolvedValue(payloadFixture);

            await controller.getFeedback(req, res);

            expect(mockFeedbackService.getFeedback).toHaveBeenCalledWith({
                connectRequestId: "req_666",
                userId: "user_mentee_789",
            });
            expect(ok).toHaveBeenCalledWith(res, payloadFixture);
        });
    });
});