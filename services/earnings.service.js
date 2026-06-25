// services/earnings.service.js
const { buildMonthlyBuckets, buildWeeklyBuckets } = require("../utils/earningsChart");
const { toEarningsSummaryDTO, toEarningsChartDTO, toPayoutHistoryDTO, toPayoutRowDTO } = require("../utils/mappers/earnings.mapper");
const createEarningsService = (earningsRepo, { logger }) => {

    /**
     * Returns earnings summary stat cards for a mentor.
     * @param {string} mentorId
     * @returns {Promise<Object>} totalEarnings, sessionsThisMonth, avgRating, pendingPayout, walletBalance
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
     * Returns chart data for earnings — monthly (6 months) or weekly (8 weeks).
     * @param {string} mentorId
     * @param {string} periodParam - "monthly" or "weekly"
     * @returns {Promise<{period: string, data: {label: string, amount: number}[]}>}
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
     * Returns a paginated, searchable list of past payouts for a mentor.
     * @param {string} mentorId
     * @param {{page?: number, limit?: number, search?: string}} options
     * @returns {Promise<{payouts: Array, pagination: Object}>}
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

        const rows = payouts.map((r) => ({
            id: r._id,
            date: r.completedAt
                ? new Date(r.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                : "—",
            menteeName: r.mentee?.name || "—",
            menteeEmail: r.mentee?.email || "—",
            sessionType: r.confirmedSlot?.day || "—",
            duration: r.confirmedSlot
                ? (() => {
                    const [sh, sm] = (r.confirmedSlot.startTime || "0:0").split(":").map(Number);
                    const [eh, em] = (r.confirmedSlot.endTime || "0:0").split(":").map(Number);
                    const mins = (eh * 60 + em) - (sh * 60 + sm);
                    return `${mins} mins`;
                })()
                : "—",
            amount: r.totalAmount || 0,
            status: r.paymentStatus || "paid",
        }));

        return toPayoutHistoryDTO({ payouts, pagination: { totalCount, currentPage: safePage, totalPages: Math.ceil(totalCount / safeLimit), hasMore: safePage < Math.ceil(totalCount / safeLimit) } });
    };

    return { getEarningsSummary, getEarningsChart, getPayoutHistory };
};
module.exports = createEarningsService;