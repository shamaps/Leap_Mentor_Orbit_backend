const AppError = require("@leapmentor/shared/utils/appError");
const { withTransaction } = require("@leapmentor/shared/utils/withTransaction");
const { LEAP_REFILL_AMOUNT } = require("@leapmentor/shared/config/constants");

const createWalletOperationsService = (repo, { transaction = withTransaction } = {}) => {
    const getBalance = async (userId) => {
        const result = await repo.findWalletBalance(userId);
        if (!result) throw new AppError(404, "User not found");
        return result;
    };

    const issueLeapRefill = async ({ userId, requestId }) => {
        const key = `leap-refill:${requestId}`;
        const fingerprint = String(userId);
        try {
            return await transaction(async (session) => {
                const existing = await repo.findWalletOperation(key, session);
                if (existing) {
                    if (String(existing.user) !== fingerprint) throw new AppError(409, "Refill key belongs to a different user");
                    return existing.result;
                }
                const existingWallet = await repo.findWallet(userId, session);
                if (!existingWallet) throw new AppError(404, "User not found");
                const wallet = await repo.incrementWalletBalance(userId, LEAP_REFILL_AMOUNT, session);
                const result = { userId: String(userId), amount: LEAP_REFILL_AMOUNT, balance: wallet.balance };
                await repo.insertTransactions([{
                    user: userId, type: "credit", amount: LEAP_REFILL_AMOUNT,
                    description: `Admin-approved Leap Points refill — ${LEAP_REFILL_AMOUNT} LP`,
                    balanceAfter: wallet.balance, idempotencyKey: `${key}:ledger`,
                }], session);
                await repo.createWalletOperation({
                    idempotencyKey: key, user: userId, kind: "leap_refill",
                    amount: LEAP_REFILL_AMOUNT, result,
                }, session);
                return result;
            }, "payments.internal.leapRefill");
        } catch (error) {
            const saved = await repo.findWalletOperation(key).catch(() => null);
            if (saved) {
                if (String(saved.user) !== fingerprint) throw new AppError(409, "Refill key belongs to a different user");
                return saved.result;
            }
            throw error;
        }
    };

    return { getBalance, issueLeapRefill };
};

module.exports = createWalletOperationsService;
