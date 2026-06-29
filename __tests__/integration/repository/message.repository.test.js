/**
 * @fileoverview Complete unit tests for Message Repository.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

const mockQuery = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    sort: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
};

jest.mock("../../../models/Message", () => ({
    find: jest.fn(() => mockQuery),
    countDocuments: jest.fn(),
    updateMany: jest.fn(),
}));

jest.mock("../../../models/ConnectRequest", () => ({
    findById: jest.fn(() => mockQuery),
}));

const Message = require("../../../models/Message");
const ConnectRequest = require("../../../models/ConnectRequest");
const repository = require("../../../repositories/message.repository");

describe("Message Repository (100% Complete Coverage Setup)", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.select.mockReturnThis();
        mockQuery.populate.mockReturnThis();
        mockQuery.sort.mockReturnThis();
        mockQuery.skip.mockReturnThis();
        mockQuery.limit.mockReturnThis();
        mockQuery.lean.mockReturnThis();
    });

    describe("findSessionParticipants", () => {
        it("should call findById with projection filters and lean conversion", async () => {
            mockQuery.lean.mockResolvedValue({ mentor: "m1", mentee: "m2" });

            const result = await repository.findSessionParticipants("cr_123");

            expect(ConnectRequest.findById).toHaveBeenCalledWith("cr_123");
            expect(mockQuery.select).toHaveBeenCalledWith("mentor mentee status");
            expect(result).toBeDefined();
        });
    });

    describe("findMessages", () => {
        it("should query paginated chat histories sequentially sorted by age", async () => {
            mockQuery.lean.mockResolvedValue([]);

            await repository.findMessages("cr_123", 10, 20);

            expect(Message.find).toHaveBeenCalledWith({ connectRequest: "cr_123" });
            expect(mockQuery.populate).toHaveBeenCalledWith("sender", "name email");
            expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: 1 });
            expect(mockQuery.skip).toHaveBeenCalledWith(10);
            expect(mockQuery.limit).toHaveBeenCalledWith(20);
        });
    });

    describe("findMessagesByCursor", () => {
        it("should apply an ID less-than restriction filter boundary when beforeId exists", async () => {
            mockQuery.lean.mockResolvedValue([]);

            await repository.findMessagesByCursor("cr_123", "msg_999", 15);

            expect(Message.find).toHaveBeenCalledWith({
                connectRequest: "cr_123",
                _id: { $lt: "msg_999" }
            });
            expect(mockQuery.sort).toHaveBeenCalledWith({ _id: -1 });
            expect(mockQuery.limit).toHaveBeenCalledWith(15);
        });

        it("should skip adding the ID filter block parameters if beforeId is omitted, falling back to page defaults", async () => {
            // CONDITION COVERAGE GAPS FILLED: beforeId is falsy, limit defaults to 30
            mockQuery.lean.mockResolvedValue([]);

            await repository.findMessagesByCursor("cr_123", null);

            expect(Message.find).toHaveBeenCalledWith({ connectRequest: "cr_123" });
            expect(mockQuery.limit).toHaveBeenCalledWith(30);
        });
    });

    describe("countMessages", () => {
        it("should return the absolute document total matching the connectRequest constraint", async () => {
            Message.countDocuments.mockResolvedValue(100);

            const count = await repository.countMessages("cr_123");

            expect(Message.countDocuments).toHaveBeenCalledWith({ connectRequest: "cr_123" });
            expect(count).toBe(100);
        });
    });

    describe("markMessagesAsRead", () => {
        it("should issue an updateMany query targeting incoming unviewed chat messages", async () => {
            Message.updateMany.mockResolvedValue({ modifiedCount: 5 });

            await repository.markMessagesAsRead("cr_123", "user_abc");

            expect(Message.updateMany).toHaveBeenCalledWith(
                { connectRequest: "cr_123", sender: { $ne: "user_abc" }, readAt: null },
                { $set: { readAt: expect.any(Date) } }
            );
        });
    });

    describe("countUnreadMessages", () => {
        it("should count items where the recipient has not viewed them yet", async () => {
            Message.countDocuments.mockResolvedValue(4);

            const unread = await repository.countUnreadMessages("cr_123", "user_abc");

            expect(Message.countDocuments).toHaveBeenCalledWith({
                connectRequest: "cr_123",
                sender: { $ne: "user_abc" },
                readAt: null,
            });
            expect(unread).toBe(4);
        });
    });
});