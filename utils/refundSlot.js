// utils/refundSlot.js
const mongoose = require("mongoose");
const AppError = require("./appError");
const logger = require("./logger");

const refundSlot = async (repo,{ connectRequestId, slotIndex, cancelledBy }) => {
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
        const connectRequest = await repo.findConnectRequestRaw(connectRequestId, mongoSession);
        if (!connectRequest) throw new AppError(404, "Connect request not found");

        const { totalAmount, sessionCount, mentee: menteeId } = connectRequest;

        if (!sessionCount || sessionCount < 1)
            throw new AppError(400, "Session count missing on connect request");

        const perSlotRefund = Math.floor(totalAmount / sessionCount);
        if (perSlotRefund < 1)
            throw new AppError(400, "Slot refund amount is too small to process");

        const menteeWallet = await repo.findWalletByUser(menteeId, mongoSession);
        if (!menteeWallet) throw new AppError(404, "Mentee wallet not found");
        if (menteeWallet.escrow < perSlotRefund)
            throw new AppError(400, "Escrow balance too low for slot refund. Contact support");

        menteeWallet.escrow -= perSlotRefund;
        menteeWallet.balance += perSlotRefund;
        await repo.saveWallet(menteeWallet, mongoSession);

        await repo.createTransactions([{
            user: menteeId,
            type: "escrow_refund",
            amount: perSlotRefund,
            connectRequest: connectRequest._id,
            description: `Slot #${slotIndex + 1} cancelled by ${cancelledBy} — partial refund of ${perSlotRefund} tokens`,
            balanceAfter: menteeWallet.balance,
        }], mongoSession);

        await mongoSession.commitTransaction();

        logger.info("Slot refund committed", {
            connectRequestId, slotIndex, cancelledBy, perSlotRefund,
            balanceAfter: menteeWallet.balance,
        });

        return {
            refundedAmount: perSlotRefund,
            balance: menteeWallet.balance,
            escrow: menteeWallet.escrow,
        };
    } catch (err) {
        await mongoSession.abortTransaction();
        logger.error("Slot refund failed", { error: err.message, connectRequestId, slotIndex, cancelledBy });
        throw err;
    } finally {
        mongoSession.endSession();
    }
};

module.exports = refundSlot;