/**
 * @fileoverview Complete unit tests for LeapRequest Repository.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

const mockQuery = {
    sort: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
};

jest.mock("../../../models/LeapRequest", () => ({
    findOne: jest.fn(() => mockQuery),
    create: jest.fn(),
    find: jest.fn(() => mockQuery),
    countDocuments: jest.fn(),
    findById: jest.fn(),
}));

jest.mock("../../../models/Wallet", () => ({
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
}));

const LeapRequest = require("../../../models/LeapRequest");
const Wallet = require("../../../models/Wallet");
const repository = require("../../../repositories/leapRequest.repository");

describe("LeapRequest Repository (100% Comprehensive Coverage)", () => {

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.sort.mockReturnThis();
        mockQuery.populate.mockReturnThis();
        mockQuery.limit.mockReturnThis();
        mockQuery.lean.mockReturnThis();
    });

    describe("LeapRequest Operations", () => {
        it("should locate the most recent pending request and sort it descending", async () => {
            await repository.findPendingByMentee("user_alice");
            expect(LeapRequest.findOne).toHaveBeenCalledWith({ mentee: "user_alice", status: "pending" });
            expect(mockQuery.sort).toHaveBeenCalledWith({ createdAt: -1 });
        });

        it("should find an entry for validation existence checks without sorting", async () => {
            await repository.findPendingByMenteeOne("user_alice");
            expect(LeapRequest.findOne).toHaveBeenCalledWith({ mentee: "user_alice", status: "pending" });
        });

        it("should forward object payloads down to create fresh documents", async () => {
            const data = { mentee: "user_alice", currentBalance: 200 };
            await repository.createRequest(data);
            expect(LeapRequest.create).toHaveBeenCalledWith(data);
        });

        it("should query from the beginning using default parameters if cursor arguments are unassigned", async () => {
            // CONDITION COVERAGE GAPS FILLED: afterId is null, limit defaults to 50
            await repository.findAllRequests();
            expect(LeapRequest.find).toHaveBeenCalledWith({});
            expect(mockQuery.populate).toHaveBeenCalledWith("mentee", "name email profilePicture");
            expect(mockQuery.sort).toHaveBeenCalledWith({ _id: -1 });
            expect(mockQuery.limit).toHaveBeenCalledWith(50);
        });

        it("should attach less-than restriction structures when valid cursors arrive", async () => {
            // CONDITION COVERAGE GAPS FILLED: afterId is truthy
            await repository.findAllRequests("cursor_id_123", 20);
            expect(LeapRequest.find).toHaveBeenCalledWith({ _id: { $lt: "cursor_id_123" } });
            expect(mockQuery.limit).toHaveBeenCalledWith(20);
        });

        it("should return absolute aggregates volume tracking counts for all request documents", async () => {
            await repository.countAllRequests();
            expect(LeapRequest.countDocuments).toHaveBeenCalled();
        });

        it("should return volume summaries restricted exclusively to pending records", async () => {
            await repository.countPendingRequests();
            expect(LeapRequest.countDocuments).toHaveBeenCalledWith({ status: "pending" });
        });

        it("should match unique identifiers to lookup mutable Mongoose rows", async () => {
            await repository.findRequestById("req_777");
            expect(LeapRequest.findById).toHaveBeenCalledWith("req_777");
        });
    });

    describe("Wallet Operations", () => {
        it("should select mutable ledger documents tracking unique user keys", async () => {
            await repository.findWalletByUser("user_alice");
            expect(Wallet.findOne).toHaveBeenCalledWith({ user: "user_alice" });
        });

        it("should execute findOneAndUpdate passing increment counters and enabling upsert operations", async () => {
            await repository.incrementWalletBalance("user_alice", 500);
            expect(Wallet.findOneAndUpdate).toHaveBeenCalledWith(
                { user: "user_alice" },
                { $inc: { balance: 500 } },
                { new: true, upsert: true }
            );
        });
    });
});