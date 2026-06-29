/**
 * @fileoverview Unit tests for Register Repository.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../models/User", () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

jest.mock("../../../models/Wallet", () => ({
    findOne: jest.fn(),
    create: jest.fn(),
}));

jest.mock("../../../models/Transaction", () => ({
    create: jest.fn(),
}));

jest.mock("../../../utils/logger", () => ({
    debug: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
}));

const User = require("../../../models/User");
const Wallet = require("../../../models/Wallet");
const Transaction = require("../../../models/Transaction");
const repository = require("../../../repositories/register.repository");

describe("Register Repository (100% Full Line Coverage Blueprint)", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe("User Operations", () => {
        it("should call findOne matching the exact normalized email query criterion", async () => {
            await repository.findUserByEmail("test@leapmentor.com");
            expect(User.findOne).toHaveBeenCalledWith({ email: "test@leapmentor.com" });
        });

        it("should execute the exact instance document save chain on safe user rows references", async () => {
            const mockUserInstance = { save: jest.fn().mockResolvedValue({ id: "usr_001" }) };
            const result = await repository.saveUser(mockUserInstance);
            expect(mockUserInstance.save).toHaveBeenCalled();
            expect(result).toEqual({ id: "usr_001" });
        });

        it("should pass dynamic user payloads forward to the create pipeline model method", async () => {
            const payload = { email: "new@test.com", roles: ["mentee"] };
            await repository.createUser(payload);
            expect(User.create).toHaveBeenCalledWith(payload);
        });
    });

    describe("Wallet Operations", () => {
        it("should query wallets filtering exactly by unique owner keys and designated role properties", async () => {
            await repository.findWalletByUserAndRole("usr_777", "mentor");
            expect(Wallet.findOne).toHaveBeenCalledWith({ user: "usr_777", role: "mentor" });
        });

        it("should initialize a new wallet record ledger using structural blueprint configurations", async () => {
            const payload = { user: "usr_777", role: "mentor", balance: 100 };
            await repository.createWallet(payload);
            expect(Wallet.create).toHaveBeenCalledWith(payload);
        });
    });

    describe("Transaction Audit Operations", () => {
        it("should append a dynamic transactional trace entry into audit ledger databases cleanly", async () => {
            const payload = { user: "usr_777", type: "bonus", amount: 50 };
            await repository.createTransaction(payload);
            expect(Transaction.create).toHaveBeenCalledWith(payload);
        });
    });
});