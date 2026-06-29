jest.mock("../../../utils/mappers/wallet.mapper", () => ({
    toWithdrawalDTO: jest.fn((data) => data),
}));

const createWalletWithdrawalService = require("../../../services/walletWithdrawal.service");

describe("Wallet Withdrawal Service (Unit)", () => {
    let mockEarningsRepo, mockLogger, service;

    beforeEach(() => {
        mockEarningsRepo = {
            findWalletDocument: jest.fn(),
            createTransaction: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createWalletWithdrawalService(mockEarningsRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("withdrawEarnings", () => {
        it("should throw AppError 404 if no matching wallet document is found", async () => {
            mockEarningsRepo.findWalletDocument.mockResolvedValue(null);

            await expect(service.withdrawEarnings("mentor_123"))
                .rejects.toMatchObject({ status: 404, message: "Wallet not found" });
        });

        it("should throw AppError 400 if the available wallet balance is zero or negative", async () => {
            mockEarningsRepo.findWalletDocument.mockResolvedValue({ balance: 0 });

            await expect(service.withdrawEarnings("mentor_123"))
                .rejects.toMatchObject({ status: 400, message: "No balance available to withdraw" });
        });

        it("should reset the balance to zero, save changes, and log a ledger transaction on successful withdrawal", async () => {
            const mockWalletDoc = {
                balance: 250,
                save: jest.fn().mockResolvedValue(),
            };
            mockEarningsRepo.findWalletDocument.mockResolvedValue(mockWalletDoc);
            mockEarningsRepo.createTransaction.mockResolvedValue({});

            const result = await service.withdrawEarnings("mentor_123");

            expect(mockWalletDoc.balance).toBe(0);
            expect(mockWalletDoc.save).toHaveBeenCalled();
            expect(mockEarningsRepo.createTransaction).toHaveBeenCalledWith({
                user: "mentor_123",
                type: "withdrawal",
                amount: 250,
                description: "Mentor withdrawal request",
                balanceAfter: 0,
            });
            expect(result.withdrawn).toBe(250);
        });
    });
});