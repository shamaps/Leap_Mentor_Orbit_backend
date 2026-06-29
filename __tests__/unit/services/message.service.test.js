jest.mock("../../../utils/mappers/message.mapper", () => ({
    toMessageListDTO: jest.fn((data) => data),
    toUnreadCountDTO: jest.fn((count) => ({ count })),
}));

const createMessageService = require("../../../services/message.service");

describe("Message Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findSessionParticipants: jest.fn(),
            findMessages: jest.fn(),
            countMessages: jest.fn(),
            findMessagesByCursor: jest.fn(),
            markMessagesAsRead: jest.fn(),
            countUnreadMessages: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createMessageService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("getMessages", () => {
        it("should throw AppError 404 if connection request lookups return empty document states", async () => {
            mockRepo.findSessionParticipants.mockResolvedValue(null);

            await expect(service.getMessages("invalid_session", "user_1", {}))
                .rejects.toMatchObject({ status: 404, message: "Session not found" });
        });

        it("should throw AppError 403 if the performing identity context drops outside relationship bounds", async () => {
            mockRepo.findSessionParticipants.mockResolvedValue({ mentor: "mentor_1", mentee: "mentee_1" });

            await expect(service.getMessages("session_1", "malicious_actor", {}))
                .rejects.toMatchObject({ status: 403, message: "Not authorized to view these messages" });
        });

        it("should mark messages as read and execute cursor pagination filters if the query specifies upper bounds", async () => {
            mockRepo.findSessionParticipants.mockResolvedValue({ mentor: "mentor_1", mentee: "mentee_1" });
            const messageFixtures = [{ _id: "m2", text: "Hi" }, { _id: "m1", text: "Hello" }];
            mockRepo.findMessagesByCursor.mockResolvedValue(messageFixtures);

            const result = await service.getMessages("session_1", "mentor_1", { before: "m3", limit: 2 });

            expect(mockRepo.markMessagesAsRead).toHaveBeenCalledWith("session_1", "mentor_1");
            expect(mockRepo.findMessagesByCursor).toHaveBeenCalledWith("session_1", "m3", 2);
            // Verifying reverse alignment pass sorting oldest items first for frontend consumption
            expect(result.messages[0].text).toBe("Hello");
        });

        it("should fallback to standard offset pagination math when before cursors parameters are missing", async () => {
            mockRepo.findSessionParticipants.mockResolvedValue({ mentor: "mentor_1", mentee: "mentee_1" });
            mockRepo.findMessages.mockResolvedValue([{ text: "Offset item" }]);
            mockRepo.countMessages.mockResolvedValue(10);

            const result = await service.getMessages("session_1", "mentee_1", { page: "2", limit: "5" });

            expect(mockRepo.findMessages).toHaveBeenCalledWith("session_1", 5, 5); // skip = (2-1)*5
            expect(result).toHaveProperty("totalCount", 10);
        });
    });
});