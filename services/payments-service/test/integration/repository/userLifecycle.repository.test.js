/**
 * @fileoverview Integration tests for the Payments user-lifecycle repository (wallet soft-delete / restore).
 */

const mongoose = require("mongoose");
const dbHandler = require("../../utils/db");
const repo = require("../../../src/repositories/userLifecycle.repository");
const Wallet = require("@leapmentor/shared/models/Wallet");

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

const newId = () => new mongoose.Types.ObjectId();

describe("Payments User Lifecycle Repository (Integration)", () => {
    describe("markWalletDeleted", () => {
        it("should flag the user's wallet as deleted using the supplied timestamp", async () => {
            const userId = newId();
            const at = new Date("2026-03-01T10:00:00Z");
            await Wallet.create({ user: userId, balance: 120, escrow: 30 });

            const result = await repo.markWalletDeleted(userId, at);

            expect(result).toEqual({ wallets: 1 });
            const wallet = await Wallet.findOne({ user: userId }).lean();
            expect(wallet.isDeleted).toBe(true);
            expect(wallet.deletedAt).toEqual(at);
        });

        it("should keep balances untouched so the ledger stays consistent", async () => {
            const userId = newId();
            await Wallet.create({ user: userId, balance: 120, escrow: 30 });

            await repo.markWalletDeleted(userId);

            const wallet = await Wallet.findOne({ user: userId }).lean();
            expect(wallet.balance).toBe(120);
            expect(wallet.escrow).toBe(30);
        });

        it("should not touch wallets that belong to other users", async () => {
            const target = newId();
            const bystander = newId();
            await Wallet.create([{ user: target }, { user: bystander }]);

            await repo.markWalletDeleted(target);

            const other = await Wallet.findOne({ user: bystander }).lean();
            expect(other.isDeleted).toBe(false);
            expect(other.deletedAt).toBeNull();
        });

        it("should be idempotent and keep the original deletedAt on a repeat call", async () => {
            const userId = newId();
            const first = new Date("2026-03-01T10:00:00Z");
            await Wallet.create({ user: userId });

            await repo.markWalletDeleted(userId, first);
            const second = await repo.markWalletDeleted(userId, new Date("2026-04-01T10:00:00Z"));

            expect(second).toEqual({ wallets: 0 });
            const wallet = await Wallet.findOne({ user: userId }).lean();
            expect(wallet.deletedAt).toEqual(first);
        });

        it("should report zero wallets when the user has no wallet", async () => {
            const result = await repo.markWalletDeleted(newId());

            expect(result).toEqual({ wallets: 0 });
        });
    });

    describe("restoreWallet", () => {
        it("should clear the deleted flag and timestamp of a deleted wallet", async () => {
            const userId = newId();
            await Wallet.create({ user: userId, isDeleted: true, deletedAt: new Date() });

            const result = await repo.restoreWallet(userId);

            expect(result).toEqual({ wallets: 1 });
            const wallet = await Wallet.findOne({ user: userId }).lean();
            expect(wallet.isDeleted).toBe(false);
            expect(wallet.deletedAt).toBeNull();
        });

        it("should not modify wallets that are already active", async () => {
            const userId = newId();
            await Wallet.create({ user: userId });

            const result = await repo.restoreWallet(userId);

            expect(result).toEqual({ wallets: 0 });
        });

        it("should only restore the wallet of the requested user", async () => {
            const target = newId();
            const bystander = newId();
            await Wallet.create([
                { user: target, isDeleted: true, deletedAt: new Date() },
                { user: bystander, isDeleted: true, deletedAt: new Date() },
            ]);

            await repo.restoreWallet(target);

            const other = await Wallet.findOne({ user: bystander }).lean();
            expect(other.isDeleted).toBe(true);
        });

        it("should round-trip with markWalletDeleted", async () => {
            const userId = newId();
            await Wallet.create({ user: userId, balance: 50 });

            await repo.markWalletDeleted(userId);
            await repo.restoreWallet(userId);

            const wallet = await Wallet.findOne({ user: userId }).lean();
            expect(wallet.isDeleted).toBe(false);
            expect(wallet.balance).toBe(50);
        });
    });
});