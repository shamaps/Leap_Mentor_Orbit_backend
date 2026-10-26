// services/engagement-service/src/services/adminEngagements.service.js

/**
 * Creates the admin engagements service.
 * @param {Object} repo - The admin engagements repository.
 * @returns {Object} Service methods.
 */
const createAdminEngagementsService = (repo) => {
    /** Engagement counts by status, plus total. */
    const fetchEngagementStats = async () => {
        const statuses = ["pending", "accepted", "rejected", "referred", "ongoing", "completed"];
        const counts = await Promise.all(statuses.map((s) => repo.countEngagementsByStatus(s)));

        const stats = Object.fromEntries(statuses.map((s, i) => [s, counts[i]]));
        stats.total = counts.reduce((a, b) => a + b, 0);
        return stats;
    };

    /** Paginated, optionally filtered list of engagements. */
    const fetchEngagements = async ({ status, search, dateFrom, dateTo, page = 1, limit = 15 }) => {
        const filter = {};

        if (status) filter.status = status;

        if (dateFrom || dateTo) {
            filter.requestedAt = {};
            if (dateFrom) filter.requestedAt.$gte = new Date(dateFrom);
            if (dateTo) filter.requestedAt.$lte = new Date(new Date(dateTo).setHours(23, 59, 59, 999));
        }

        if (search?.trim()) {
            const ids = await repo.findUserIdsBySearchTerm(search.trim());
            filter.$or = [{ mentor: { $in: ids } }, { mentee: { $in: ids } }];
        }

        const skip = (Number(page) - 1) * Number(limit);
        const total = await repo.countEngagements(filter);
        const engagements = await repo.findEngagements(filter, skip, Number(limit));

        return {
            engagements,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        };
    };

    return { fetchEngagementStats, fetchEngagements };
};

module.exports = createAdminEngagementsService;