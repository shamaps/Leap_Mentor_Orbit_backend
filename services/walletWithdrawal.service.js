// services/walletWithdrawal.service.js
const AppError = require("../utils/appError");
const createWalletWithdrawalService = (earningsRepo, { logger }) => {
    /**
     * Withdraws the mentor's full available wallet balance.
     * @param {string} mentorId
     * @returns {Promise<{message: string, withdrawn: number, newBalance: number}>}
     * @throws {AppError} 404 if no wallet, 400 if balance is zero
     */
    const withdrawEarnings = async (mentorId) => {
        const wallet = await earningsRepo.findWalletDocument(mentorId);

        if (!wallet) {
            throw new AppError(404, "Wallet not found");
        }
        if (wallet.balance <= 0) {
            throw new AppError(400, "No balance available to withdraw");
        }

        const withdrawn = wallet.balance;
        wallet.balance = 0;
        await wallet.save();

        await earningsRepo.createTransaction({
            user: mentorId,
            type: "withdrawal",
            amount: withdrawn,
            description: "Mentor withdrawal request",
            balanceAfter: 0,
        });

        return {
            message: "Withdrawal request submitted successfully",
            withdrawn,
            newBalance: 0,
        };
    };

    return { withdrawEarnings };
};
module.exports = createWalletWithdrawalService;