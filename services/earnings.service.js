// services/earnings.service.js
const { buildMonthlyBuckets, buildWeeklyBuckets } = require("../utils/earningsChart");
const { toEarningsSummaryDTO, toEarningsChartDTO, toPayoutHistoryDTO, toPayoutRowDTO } = require("../utils/mappers/earnings.mapper");

/**
 * @typedef {Object} EarningsRepository
 * @property {(mentorId: string) => Promise<Object[]>} findCompletedSessions - Fetches completed mentorship interaction documents.
 * @property {(mentorId: string) => Promise<Object|null>} findMentorProfileStats - Resolves profile scores and total metrics.
 * @property {(mentorId: string) => Promise<Object[]>} findOngoingPaidSessions - Tracks ongoing matches where financial capture is verified.
 * @property {(mentorId: string) => Promise<Object|null>} findWallet - Pulls current wallet information.
 * @property {(mentorId: string, startDate: Date) => Promise<Object[]>} findCompletedSessionsSince - Pulls sequential records bounded by date targets.
 * @property {(search: string) => Promise<Object[]>} findUserIdsByName - Maps wildcard search text to array sets of account indices.
 * @property {(query: Object) => Promise<number>} countPayouts - Quantifies historical matching records.
 * @property {(query: Object, skip: number, limit: number) => Promise<Object[]>} findPayouts - Executes a structured paginated search return.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function constructing the specialized Mentor Earnings Service layer.
 * * @param {EarningsRepository} earningsRepo - Data layer persistence abstraction interface.
 * @param {{ logger: Logger }} dependencies - Application telemetry tracing infrastructure.
 * @returns {Object} Configured object map exposing financial reporting methods.
 */
const createEarningsService = (earningsRepo, { logger }) => {

    /**
     * Aggregates completed earnings, current active month velocity, feedback ratings, locked escrow pipelines, and active liquidity balances.
     * * @async
     * @function getEarningsSummary
     * @param {string} mentorId - System identifier string matching host profile.
     * @returns {Promise<Object>} Formatted summary DTO displaying metrics card properties.
     */
    const getEarningsSummary = async (mentorId) => {
        const completed = await earningsRepo.findCompletedSessions(mentorId);
        const totalEarnings = completed.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const sessionsThisMonth = completed.filter(
            (r) => r.completedAt && new Date(r.completedAt) >= monthStart
        ).length;

        const mentorProfile = await earningsRepo.findMentorProfileStats(mentorId);
        const avgRating = mentorProfile?.avgRating || 0;

        const ongoingSessions = await earningsRepo.findOngoingPaidSessions(mentorId);
        const pendingPayout = ongoingSessions.reduce((sum, r) => sum + (r.mentorPayout || 0), 0);

        const wallet = await earningsRepo.findWallet(mentorId);
        return toEarningsSummaryDTO({ totalEarnings, sessionsThisMonth, avgRating, pendingPayout, walletBalance: wallet?.balance || 0 });
    };

    /**
     * Resolves timeline buckets computing localized revenue spikes across defined historical intervals.
     * * @async
     * @function getEarningsChart
     * @param {string} mentorId - Profile tracker identifier index parameter.
     * @param {string} periodParam - Timeline tracking resolution selector key ("monthly" or "weekly").
     * @returns {Promise<{period: string, data: {label: string, amount: number}[]}>} Complete structural map representing graph coordinates.
     */
    const getEarningsChart = async (mentorId, periodParam) => {
        const period = periodParam === "weekly" ? "weekly" : "monthly";
        const now = new Date();

        if (period === "monthly") {
            const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
            const completed = await earningsRepo.findCompletedSessionsSince(mentorId, startDate);
            return toEarningsChartDTO({ period, data: buildMonthlyBuckets(completed, now) });
        }

        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 55);
        const completed = await earningsRepo.findCompletedSessionsSince(mentorId, startDate);
        return toEarningsChartDTO({ period, data: buildWeeklyBuckets(completed, now) });
    };

    /**
     * Compiles a searchable, paginated ledger list containing finalized billing distributions.
     * * @async
     * @function getPayoutHistory
     * @param {string} mentorId - Target query host system reference identity.
     * @param {Object} options - Search constraints and pagination boundaries package context.
     * @param {number|string} [options.page] - Dynamic target page selector parameter index.
     * @param {number|string} [options.limit] - Bounds density configuration parameter determining list element counts.
     * @param {string} [options.search] - Case-insensitive wildcard user literal matching candidate profiles.
     * @returns {Promise<{payouts: Array, pagination: {totalCount: number, currentPage: number, totalPages: number, hasMore: boolean}}>} Formatted historical data transfer result payload.
     */
    const getPayoutHistory = async (mentorId, { page, limit, search }) => {
        const safePage = Math.max(1, Number.parseInt(page) || 1);
        const safeLimit = Math.min(20, Number.parseInt(limit) || 10);
        const safeSearch = search?.trim() || "";
        const skip = (safePage - 1) * safeLimit;

        const query = { mentor: mentorId, status: "completed" };

        if (safeSearch) {
            const matchingUsers = await earningsRepo.findUserIdsByName(safeSearch);
            query.mentee = { $in: matchingUsers.map((u) => u._id) };
        }

        const [totalCount, payouts] = await Promise.all([
            earningsRepo.countPayouts(query),
            earningsRepo.findPayouts(query, skip, safeLimit),
        ]);

        return toPayoutHistoryDTO({ payouts, pagination: { totalCount, currentPage: safePage, totalPages: Math.ceil(totalCount / safeLimit), hasMore: safePage < Math.ceil(totalCount / safeLimit) } });
    };

    return { getEarningsSummary, getEarningsChart, getPayoutHistory };
};

module.exports = createEarningsService;