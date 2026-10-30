const createUserLifecycleService = (repo, { logger } = {}) => {
    const hardDelete = async (userId) => {
        const result = await repo.markWalletDeleted(userId);
        logger?.info?.("Wallet marked deleted for removed user; ledger retained", { userId: String(userId), ...result });
        return { ...result, retained: true };
    };
    const softDelete = async (userId) => {
        const result = await repo.markWalletDeleted(userId);
        logger?.info?.("Wallet marked deleted for soft-deleted user", { userId: String(userId), ...result });
        return result;
    };
    const restore = async (userId) => {
        const result = await repo.restoreWallet(userId);
        logger?.info?.("Wallet restored for user", { userId: String(userId), ...result });
        return result;
    };
    return { hardDelete, softDelete, restore };
};

module.exports = createUserLifecycleService;