/**
 * @fileoverview Unit tests for the Wallet Operations service (balance lookup + idempotent Leap refill).
 */

const createWalletOperationsService = require("../../../src/services/walletOperations.service");
const { LEAP_REFILL_AMOUNT } = require("@leapmentor/shared/config/constants");
const AppError = require("@leapmentor/shared/utils/appError");

const USER = "a".repeat(24);
const OTHER_USER = "c".repeat(24);
const REQ = "b".repeat(24);
const KEY = `leap-refill:${REQ}`;

// Built per test so every test starts with fresh mocks.
const makeRepo = (overrides = {}) => ({
    findWalletBalance: jest.fn().mockResolvedValue({ balance: 40, escrow: 5 }),
    findWalletOperation: jest.fn().mockResolvedValue(null),
    findWallet: jest.fn().mockResolvedValue({ user: USER, balance: 10 }),
    incrementWalletBalance: jest.fn().mockResolvedValue({ balance: 10 + LEAP_REFILL_AMOUNT }),
    insertTransactions: jest.fn().mockResolvedValue(undefined),
    createWalletOperation: jest.fn().mockResolvedValue(undefined),
    ...overrides,
});

// Runs the callback with a fake session, like withTransaction does.
const makeTransaction = () => jest.fn(async (fn) => fn("SESSION"));

const build = (repoOverrides) => {
    const repo = makeRepo(repoOverrides);
    const transaction = makeTransaction();
    const service = createWalletOperationsService(repo, { transaction });
    return { service, repo, transaction };
};

describe("Wallet Operations Service", () => {
    describe("getBalance", () => {
        it("should return the wallet balance row for a known user", async () => {
            const { service, repo } = build();

            const result = await service.getBalance(USER);

            expect(result).toEqual({ balance: 40, escrow: 5 });
            expect(repo.findWalletBalance).toHaveBeenCalledWith(USER);
        });

        it("should throw a 404 when the user has no wallet", async () => {
            const { service } = build({ findWalletBalance: jest.fn().mockResolvedValue(null) });

            await expect(service.getBalance(USER)).rejects.toHaveProperty("status", 404);
        });
    });

    describe("issueLeapRefill", () => {
        it("should credit the wallet, write the ledger row and record the operation inside one transaction", async () => {
            const { service, repo, transaction } = build();

            const result = await service.issueLeapRefill({ userId: USER, requestId: REQ });

            expect(result).toEqual({ userId: USER, amount: LEAP_REFILL_AMOUNT, balance: 10 + LEAP_REFILL_AMOUNT });
            expect(transaction).toHaveBeenCalledTimes(1);
            expect(transaction.mock.calls[0][1]).toBe("payments.internal.leapRefill");
            expect(repo.incrementWalletBalance).toHaveBeenCalledWith(USER, LEAP_REFILL_AMOUNT, "SESSION");

            const [rows, session] = repo.insertTransactions.mock.calls[0];
            expect(session).toBe("SESSION");
            expect(rows).toHaveLength(1);
            expect(rows[0]).toMatchObject({
                user: USER,
                type: "credit",
                amount: LEAP_REFILL_AMOUNT,
                balanceAfter: 10 + LEAP_REFILL_AMOUNT,
                idempotencyKey: `${KEY}:ledger`,
            });

            expect(repo.createWalletOperation).toHaveBeenCalledWith({
                idempotencyKey: KEY,
                user: USER,
                kind: "leap_refill",
                amount: LEAP_REFILL_AMOUNT,
                result,
            }, "SESSION");
        });

        it("should return the saved result on a replay without crediting again", async () => {
            const saved = { userId: USER, amount: LEAP_REFILL_AMOUNT, balance: 510 };
            const { service, repo } = build({
                findWalletOperation: jest.fn().mockResolvedValue({ user: USER, result: saved }),
            });

            const result = await service.issueLeapRefill({ userId: USER, requestId: REQ });

            expect(result).toEqual(saved);
            expect(repo.incrementWalletBalance).not.toHaveBeenCalled();
            expect(repo.insertTransactions).not.toHaveBeenCalled();
            expect(repo.createWalletOperation).not.toHaveBeenCalled();
        });

        it("should reject with 409 when the refill key already belongs to a different user", async () => {
            const { service, repo } = build({
                findWalletOperation: jest.fn().mockResolvedValue({ user: OTHER_USER, result: {} }),
            });

            await expect(service.issueLeapRefill({ userId: USER, requestId: REQ }))
                .rejects.toMatchObject({ status: 409, message: "Refill key belongs to a different user" });
            expect(repo.incrementWalletBalance).not.toHaveBeenCalled();
        });

        it("should throw a 404 and credit nothing when the wallet does not exist", async () => {
            const { service, repo } = build({ findWallet: jest.fn().mockResolvedValue(null) });

            await expect(service.issueLeapRefill({ userId: USER, requestId: REQ }))
                .rejects.toMatchObject({ status: 404, message: "User not found" });
            expect(repo.incrementWalletBalance).not.toHaveBeenCalled();
            expect(repo.createWalletOperation).not.toHaveBeenCalled();
        });

        it("should recover the saved result when the transaction fails but an earlier attempt already committed", async () => {
            const saved = { userId: USER, amount: LEAP_REFILL_AMOUNT, balance: 510 };
            const repo = makeRepo({
                findWalletOperation: jest.fn().mockResolvedValue({ user: USER, result: saved }),
            });
            const transaction = jest.fn().mockRejectedValue(new Error("write conflict"));
            const service = createWalletOperationsService(repo, { transaction });

            const result = await service.issueLeapRefill({ userId: USER, requestId: REQ });

            expect(result).toEqual(saved);
        });

        it("should rethrow the original error when the transaction fails and nothing was saved", async () => {
            const repo = makeRepo();
            const transaction = jest.fn().mockRejectedValue(new Error("write conflict"));
            const service = createWalletOperationsService(repo, { transaction });

            await expect(service.issueLeapRefill({ userId: USER, requestId: REQ }))
                .rejects.toThrow("write conflict");
        });

        it("should rethrow the original error when looking up the saved operation also fails", async () => {
            const repo = makeRepo({ findWalletOperation: jest.fn().mockRejectedValue(new Error("db down")) });
            const transaction = jest.fn().mockRejectedValue(new Error("write conflict"));
            const service = createWalletOperationsService(repo, { transaction });

            await expect(service.issueLeapRefill({ userId: USER, requestId: REQ }))
                .rejects.toThrow("write conflict");
        });

        it("should not let a saved operation of another user be returned after a failed transaction", async () => {
            const repo = makeRepo({
                findWalletOperation: jest.fn().mockResolvedValue({ user: OTHER_USER, result: { balance: 1 } }),
            });
            const transaction = jest.fn().mockRejectedValue(new Error("write conflict"));
            const service = createWalletOperationsService(repo, { transaction });

            await expect(service.issueLeapRefill({ userId: USER, requestId: REQ }))
                .rejects.toBeInstanceOf(AppError);
        });
    });
});