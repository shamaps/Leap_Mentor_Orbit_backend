const createInternalUsersService = (repo, { logger } = {}) => {
    const hardDelete = async (userId) => {
        const result = await repo.deleteRequestsForUser(userId);
        logger?.info?.("Connect requests deleted for user", { userId: String(userId), ...result });
        return result;
    };
    const softDelete = async (userId) => {
        const result = await repo.cancelPendingRequestsForUser(userId);
        logger?.info?.("Pending connect requests cancelled for user", { userId: String(userId), ...result });
        return result;
    };
    return { hardDelete, softDelete };
};

module.exports = createInternalUsersService;