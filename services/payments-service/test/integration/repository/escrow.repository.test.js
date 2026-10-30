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

jest.mock("@leapmentor/shared/models/ConnectRequest", () => ({
    findById: jest.fn(() => mockQuery),
}));

jest.mock("@leapmentor/shared/models/Wallet", () => ({
    findOne: jest.fn(() => mockQuery),
}));

jest.mock("@leapmentor/shared/models/Transaction", () => ({
    insertMany: jest.fn(),
}));

jest.mock("@leapmentor/shared/models/AdminUser", () => ({
    findOne: jest.fn(() => mockQuery),
}));

jest.mock("@leapmentor/shared/models/Availability", () => ({
    findOne: jest.fn(() => mockQuery),
}));

jest.mock("@leapmentor/shared/models/Escrow", () => ({
    findOne: jest.fn(() => mockQuery),
}));

jest.mock("@leapmentor/shared/utils/logger", () => ({
    debug: jest.fn(),
    error: jest.fn(),
}));

const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const Wallet = require("@leapmentor/shared/models/Wallet");
const Transaction = require("@leapmentor/shared/models/Transaction");
const AdminUser = require("@leapmentor/shared/models/AdminUser");
const Availability = require("@leapmentor/shared/models/Availability");
const Escrow = require("@leapmentor/shared/models/Escrow");
const repository = require("../../../src/repositories/escrow.repository");

describe("Escrow Repository (100% Full Branch Coverage)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        Object.values(mockQuery).forEach(m => m.mockReturnThis());
    });

    describe("Admin Operations", () => {
        it("should find the active admin user row with projection limits", async () => {
            await repository.findActiveAdmin();
            expect(AdminUser.findOne).toHaveBeenCalledWith({ isActive: true });
            expect(mockQuery.select).toHaveBeenCalledWith("commissionRate");
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
    });

    describe("Escrow Ledger Lookups", () => {
        it("should find the escrow by request id and bind the session when one is given", async () => {
            mockQuery.session = jest.fn().mockReturnThis();
            await repository.findEscrowByRequest("req_1", "mock_session");
            expect(Escrow.findOne).toHaveBeenCalledWith({ requestId: "req_1" });
            expect(mockQuery.session).toHaveBeenCalledWith("mock_session");
        });

        it("should return the bare query when no session is supplied", async () => {
            mockQuery.session = jest.fn().mockReturnThis();
            const result = await repository.findEscrowByRequest("req_1");
            expect(result).toBe(mockQuery);
            expect(mockQuery.session).not.toHaveBeenCalled();
        });

        it("should save the escrow with or without a session", async () => {
            const escrow = { save: jest.fn().mockResolvedValue("saved") };
            await repository.saveEscrow(escrow, "mock_session");
            expect(escrow.save).toHaveBeenCalledWith({ session: "mock_session" });
            await repository.saveEscrow(escrow);
            expect(escrow.save).toHaveBeenLastCalledWith(undefined);
        });
    });
});
