// services/walletWithdrawal.service.js
const AppError = require("../utils/appError");
const { toWithdrawalDTO } = require("../utils/mappers/wallet.mapper");

/**
 * Service initialization factory closure encapsulating dependencies for wallet operations.
 * * @param {Object} earningsRepo - Repository instance managing wallet documents and transactions.
 * @param {Object} configOptions - System options configuration wrapper.
 * @param {Object} configOptions.logger - App system logger implementation context instance.
 * @returns {Object} Encapsulated service object containing core wallet withdrawal operations.
 */
const createWalletWithdrawalService = (earningsRepo, { logger }) => {
    /**
     * Withdraws the mentor's full available wallet balance.
     * * @param {string|import('mongoose').Types.ObjectId} mentorId - Unique ID of the mentor requestor.
     * @returns {Promise<{message: string, withdrawn: number, newBalance: number}>} Formatted DTO summary outlining the outcome.
     * @throws {AppError} 404 if no wallet is found, 400 if the current balance is zero or less.
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

        return toWithdrawalDTO({ message: "Withdrawal request submitted successfully", withdrawn, newBalance: 0 });
    };

    return { withdrawEarnings };
};

module.exports = createWalletWithdrawalService;