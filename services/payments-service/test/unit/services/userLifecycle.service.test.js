/**
 * @fileoverview Unit tests for the Payments user-lifecycle service (wallet soft-delete / restore).
 */

const createUserLifecycleService = require("../../../src/services/userLifecycle.service");

const USER = "a".repeat(24);

const makeRepo = () => ({
    markWalletDeleted: jest.fn().mockResolvedValue({ wallets: 1 }),
    restoreWallet: jest.fn().mockResolvedValue({ wallets: 1 }),
});

const makeLogger = () => ({ info: jest.fn() });

describe("Payments User Lifecycle Service", () => {
    describe("hardDelete", () => {
        it("should mark the wallet deleted, retain the ledger and flag the result as retained", async () => {
            const repo = makeRepo();
            const service = createUserLifecycleService(repo, { logger: makeLogger() });

            const result = await service.hardDelete(USER);

            expect(repo.markWalletDeleted).toHaveBeenCalledWith(USER);
            expect(result).toEqual({ wallets: 1, retained: true });
        });

        it("should log with the user id as a string and the affected wallet count", async () => {
            const repo = makeRepo();
            repo.markWalletDeleted.mockResolvedValue({ wallets: 2 });
            const logger = makeLogger();
            const service = createUserLifecycleService(repo, { logger });
            const objectIdLike = { toString: () => USER };

            await service.hardDelete(objectIdLike);

            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("ledger retained"),
                expect.objectContaining({ userId: USER, wallets: 2 })
            );
        });
    });

    describe("softDelete", () => {
        it("should mark the wallet deleted and return the repository result without the retained flag", async () => {
            const repo = makeRepo();
            const logger = makeLogger();
            const service = createUserLifecycleService(repo, { logger });

            const result = await service.softDelete(USER);

            expect(repo.markWalletDeleted).toHaveBeenCalledWith(USER);
            expect(result).toEqual({ wallets: 1 });
            expect(result).not.toHaveProperty("retained");
            expect(logger.info).toHaveBeenCalledTimes(1);
        });
    });

    describe("restore", () => {
        it("should restore the wallet and return the repository result", async () => {
            const repo = makeRepo();
            repo.restoreWallet.mockResolvedValue({ wallets: 3 });
            const logger = makeLogger();
            const service = createUserLifecycleService(repo, { logger });

            const result = await service.restore(USER);

            expect(repo.restoreWallet).toHaveBeenCalledWith(USER);
            expect(repo.markWalletDeleted).not.toHaveBeenCalled();
            expect(result).toEqual({ wallets: 3 });
            expect(logger.info).toHaveBeenCalledWith(
                expect.stringContaining("restored"),
                expect.objectContaining({ userId: USER, wallets: 3 })
            );
        });
    });

    describe("logger handling", () => {
        it("should work when no logger is provided", async () => {
            const service = createUserLifecycleService(makeRepo());

            await expect(service.hardDelete(USER)).resolves.toEqual({ wallets: 1, retained: true });
            await expect(service.softDelete(USER)).resolves.toEqual({ wallets: 1 });
            await expect(service.restore(USER)).resolves.toEqual({ wallets: 1 });
        });

        it("should work when the logger has no info method", async () => {
            const service = createUserLifecycleService(makeRepo(), { logger: {} });

            await expect(service.softDelete(USER)).resolves.toEqual({ wallets: 1 });
        });
    });

    it("should propagate repository failures to the caller", async () => {
        const repo = makeRepo();
        repo.markWalletDeleted.mockRejectedValue(new Error("db down"));
        const service = createUserLifecycleService(repo, { logger: makeLogger() });

        await expect(service.hardDelete(USER)).rejects.toThrow("db down");
        await expect(service.softDelete(USER)).rejects.toThrow("db down");
    });
});