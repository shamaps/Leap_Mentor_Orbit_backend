const Wallet = require("@leapmentor/shared/models/Wallet");

const markWalletDeleted = async (userId, now = new Date()) => {
    const result = await Wallet.updateMany(
        { user: userId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: now } }
    );
    return { wallets: result.modifiedCount ?? 0 };
};

const restoreWallet = async (userId) => {
    const result = await Wallet.updateMany(
        { user: userId, isDeleted: true },
        { $set: { isDeleted: false, deletedAt: null } }
    );
    return { wallets: result.modifiedCount ?? 0 };
};

module.exports = { markWalletDeleted, restoreWallet };