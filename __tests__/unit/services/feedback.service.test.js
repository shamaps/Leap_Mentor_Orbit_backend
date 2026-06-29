jest.mock("../../../utils/mappers/feedback.mapper", () => ({
    toFeedbackDTO: jest.fn((data) => data),
}));

const createFeedbackService = require("../../../services/feedback.service");

describe("Feedback Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findSessionById: jest.fn(),
            findSessionForRead: jest.fn(),
            findExistingFeedback: jest.fn(),
            createFeedback: jest.fn(),
            findFeedbackById: jest.fn(),
            findFeedbackBySession: jest.fn(),
            findAllFeedbackForMentor: jest.fn(),
            computeMentorAvgRating: jest.fn(),
            updateMentorAvgRating: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
        service = createFeedbackService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("submitFeedback", () => {
        it("should throw AppError 400 if bounded rating parameters go out of standard 1-5 layout ranges", async () => {
            await expect(service.submitFeedback({ connectRequestId: "r1", rating: 6, userId: "u1" }))
                .rejects.toMatchObject({ status: 400, message: "rating must be between 1 and 5" });
        });

        it("should throw AppError 404 if matching connect session documents fail to load", async () => {
            mockRepo.findSessionById.mockResolvedValue(null);

            await expect(service.submitFeedback({ connectRequestId: "r1", rating: 5, userId: "u1" }))
                .rejects.toMatchObject({ status: 404, message: "Session not found" });
        });

        it("should throw AppError 403 if user credentials mismatch all session relationship ties", async () => {
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "u1" });

            await expect(service.submitFeedback({ connectRequestId: "r1", rating: 5, userId: "unauthorized_user" }))
                .rejects.toMatchObject({ status: 403, message: "Not authorized to submit feedback for this session" });
        });

        it("should throw AppError 400 if specific slot selections miss valid completion marks", async () => {
            mockRepo.findSessionById.mockResolvedValue({
                mentor: "m1",
                mentee: "u1",
                selectedSlots: [{ menteeMarked: false, mentorMarked: false }],
            });

            await expect(service.submitFeedback({ connectRequestId: "r1", rating: 5, slotIndex: 0, userId: "u1" }))
                .rejects.toMatchObject({ status: 400, message: "Feedback can only be submitted for completed sessions" });
        });

        it("should throw AppError 409 if a duplicate review signature already populates tracking data logs", async () => {
            mockRepo.findSessionById.mockResolvedValue({ mentor: "m1", mentee: "u1", status: "completed" });
            mockRepo.findExistingFeedback.mockResolvedValue({ _id: "feed_exists" });

            await expect(service.submitFeedback({ connectRequestId: "r1", rating: 5, userId: "u1" }))
                .rejects.toMatchObject({ status: 409, message: "You have already submitted feedback for this session" });
        });

        it("should write record values and trigger dynamic arithmetic average recalculations on mentee submissions", async () => {
            mockRepo.findSessionById.mockResolvedValue({ mentor: "mentor_1", mentee: "mentee_1", status: "completed" });
            mockRepo.findExistingFeedback.mockResolvedValue(null);
            mockRepo.createFeedback.mockResolvedValue({ _id: "new_feed" });
            mockRepo.computeMentorAvgRating.mockResolvedValue([{ _id: "mentor_1", avg: 4.666, count: 3 }]);
            mockRepo.findFeedbackById.mockResolvedValue({ _id: "new_feed", rating: 5 });

            const res = await service.submitFeedback({ connectRequestId: "r1", rating: 5, comment: " Great! ", userId: "mentee_1" });

            expect(mockRepo.createFeedback).toHaveBeenCalledWith(expect.objectContaining({
                from: "mentee_1",
                to: "mentor_1",
                comment: "Great!",
            }));
            expect(mockRepo.computeMentorAvgRating).toHaveBeenCalledWith("mentor_1");
            expect(mockRepo.updateMentorAvgRating).toHaveBeenCalledWith("mentor_1", 4.7); // Fixed to 1 decimal place
            expect(res).toHaveProperty("rating", 5);
        });
    });
});