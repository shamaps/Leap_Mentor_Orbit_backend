/**
 * @fileoverview Complete unit tests for Escrow Repository.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

const mockQuery = {
    select: jest.fn().mockReturnThis(),
    populate: jest.fn().mockReturnThis(),
    session: jest.fn().mockReturnThis(),
    lean: jest.fn().mockReturnThis(),
};

jest.mock("../../../models/ConnectRequest", () => ({
    findById: jest.fn(() => mockQuery),
}));

jest.mock("../../../models/Wallet", () => ({
    findOne: jest.fn(() => mockQuery),
}));

jest.mock("../../../models/Transaction", () => ({
    insertMany: jest.fn(),
}));

jest.mock("../../../models/AdminUser", () => ({
    findOne: jest.fn(() => mockQuery),
    findByIdAndUpdate: jest.fn(),
}));

jest.mock("../../../models/Availability", () => ({
    findOne: jest.fn(() => mockQuery),
}));

jest.mock("../../../models/MentorProfile", () => ({
    findOneAndUpdate: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
    debug: jest.fn(),
    error: jest.fn(),
}));

const ConnectRequest = require("../../../models/ConnectRequest");
const Wallet = require("../../../models/Wallet");
const Transaction = require("../../../models/Transaction");
const AdminUser = require("../../../models/AdminUser");
const Availability = require("../../../models/Availability");
const MentorProfile = require("../../../models/MentorProfile");
const repository = require("../../../repositories/escrow.repository");

describe("Escrow Repository (100% Full Branch Coverage)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.values(mockQuery).forEach(m => m.mockReturnThis());
    });

    describe("Admin Operations", () => {
        it("should find the active admin user row with projection limits", async () => {
            await repository.findActiveAdmin();
            expect(AdminUser.findOne).toHaveBeenCalledWith({ isActive: true });
            expect(mockQuery.select).toHaveBeenCalledWith("commissionRate walletBalance");
        });

        it("should credit the admin wallet balance inside an active session", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is truthy
            const mockSession = { id: "session_token_1" };
            await repository.creditAdmin("admin_id", 250, mockSession);
            expect(AdminUser.findByIdAndUpdate).toHaveBeenCalledWith(
                "admin_id",
                { $inc: { walletBalance: 250 } },
                { session: mockSession }
            );
        });

        it("should credit the admin wallet balance out of a transaction context", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is falsy
            await repository.creditAdmin("admin_id", 250, null);
            expect(AdminUser.findByIdAndUpdate).toHaveBeenCalledWith(
                "admin_id",
                { $inc: { walletBalance: 250 } },
                {}
            );
        });
    });

    describe("Connect Request Operations", () => {
        it("should look up a request by id and cascade populates with active sessions hooks", async () => {
            await repository.findConnectRequestById("cr_999", "mock_session");
            expect(ConnectRequest.findById).toHaveBeenCalledWith("cr_999");
            expect(mockQuery.populate).toHaveBeenCalledWith("mentee", "name email");
            expect(mockQuery.populate).toHaveBeenCalledWith("mentor", "name email");
            expect(mockQuery.session).toHaveBeenCalledWith("mock_session");
        });

        it("should extract a compact lean representation map", async () => {
            await repository.findConnectRequestByIdLean("cr_999");
            expect(ConnectRequest.findById).toHaveBeenCalledWith("cr_999");
            expect(mockQuery.select).toHaveBeenCalledWith(expect.stringContaining("paymentStatus"));
            expect(mockQuery.lean).toHaveBeenCalled();
        });

        it("should isolate unpopulated raw items tracking session filters", async () => {
            await repository.findConnectRequestRaw("cr_999", "mock_session");
            expect(ConnectRequest.findById).toHaveBeenCalledWith("cr_999");
            expect(mockQuery.session).toHaveBeenCalledWith("mock_session");
        });

        it("should invoke save passing session parameters when tracking options are specified", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is truthy
            const mockDoc = { save: jest.fn() };
            await repository.saveConnectRequest(mockDoc, "mock_session");
            expect(mockDoc.save).toHaveBeenCalledWith({ session: "mock_session" });
        });

        it("should invoke save without arguments when sessions references are omitted", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is falsy
            const mockDoc = { save: jest.fn() };
            await repository.saveConnectRequest(mockDoc, null);
            expect(mockDoc.save).toHaveBeenCalledWith(undefined);
        });
    });

    describe("Wallet Operations", () => {
        it("should extract full instanced user wallet matching transactional options", async () => {
            await repository.findWalletByUser("user_123", "mock_session");
            expect(Wallet.findOne).toHaveBeenCalledWith({ user: "user_123" });
            expect(mockQuery.session).toHaveBeenCalledWith("mock_session");
        });

        it("should provide un-instanced lean data parameters for wallet looks", async () => {
            await repository.findWalletByUserLean("user_123");
            expect(Wallet.findOne).toHaveBeenCalledWith({ user: "user_123" });
            expect(mockQuery.select).toHaveBeenCalledWith("balance escrow");
            expect(mockQuery.lean).toHaveBeenCalled();
        });

        it("should trigger wallet save mapping session tracking settings", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is truthy
            const mockWallet = { save: jest.fn() };
            await repository.saveWallet(mockWallet, "mock_session");
            expect(mockWallet.save).toHaveBeenCalledWith({ session: "mock_session" });
        });

        it("should trigger wallet save without parameters if unassigned", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is falsy
            const mockWallet = { save: jest.fn() };
            await repository.saveWallet(mockWallet, null);
            expect(mockWallet.save).toHaveBeenCalledWith(undefined);
        });
    });

    describe("Transaction Audit and Metadata Logging", () => {
        it("should write batch documents arrays with correct tracking restrictions rules", async () => {
            const docs = [{ amount: 100 }];
            await repository.createTransactions(docs, "mock_session");
            expect(Transaction.insertMany).toHaveBeenCalledWith(docs, { session: "mock_session", ordered: true });
        });
    });

    describe("Availability & Profiles Modifiers", () => {
        it("should return targeted provider geolocation/timezone tracking properties", async () => {
            await repository.findMentorTimezone("mentor_777");
            expect(Availability.findOne).toHaveBeenCalledWith({ mentor: "mentor_777" });
            expect(mockQuery.select).toHaveBeenCalledWith("timezone");
            expect(mockQuery.lean).toHaveBeenCalled();
        });

        it("should increment velocity counters for completed sessions within transactions", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is truthy
            await repository.incrementMentorSessions("mentor_777", "mock_session");
            expect(MentorProfile.findOneAndUpdate).toHaveBeenCalledWith(
                { user: "mentor_777" },
                { $inc: { totalSessions: 1 } },
                { session: "mock_session" }
            );
        });

        it("should increment velocity counters outside an active transaction block context", async () => {
            // CONDITION COVERAGE GAPS FILLED: session is falsy
            await repository.incrementMentorSessions("mentor_777", null);
            expect(MentorProfile.findOneAndUpdate).toHaveBeenCalledWith(
                { user: "mentor_777" },
                { $inc: { totalSessions: 1 } },
                {}
            );
        });
    });
});