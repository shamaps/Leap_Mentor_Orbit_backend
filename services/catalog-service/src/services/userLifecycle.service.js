const createUserLifecycleService = (repo, { logger } = {}) => {
    const hardDelete = async (userId) => {
        const result = await repo.deleteProfiles(userId);
        logger?.info?.("Catalog profiles deleted for user", { userId: String(userId), ...result });
        return result;
    };
    const softDelete = async (userId) => {
        const result = await repo.softDeleteProfiles(userId);
        logger?.info?.("Catalog profiles soft-deleted for user", { userId: String(userId), ...result });
        return result;
    };
    const restore = async (userId) => {
        const result = await repo.restoreProfiles(userId);
        logger?.info?.("Catalog profiles restored for user", { userId: String(userId), ...result });
        return result;
    };
    return { hardDelete, softDelete, restore };
};

module.exports = createUserLifecycleService;