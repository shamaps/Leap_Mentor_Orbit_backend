// services/earnings.service.js
const earningsRepo = require("../repositories/earnings.repository");

const { logger } = require("@sentry/node");
// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings
// ─────────────────────────────────────────────────────────────
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
    const pendingPayout = ongoingSessions.reduce(
        (sum, r) => sum + (r.mentorPayout || 0), 0
    );

    const wallet = await earningsRepo.findWallet(mentorId);

    return {
        totalEarnings,
        sessionsThisMonth,
        avgRating,
        pendingPayout,
        walletBalance: wallet?.balance || 0,
    };
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings/chart?period=monthly|weekly
// ─────────────────────────────────────────────────────────────
const getEarningsChart = async (mentorId, periodParam) => {
    const period = periodParam === "weekly" ? "weekly" : "monthly";
    const now = new Date();
    let data = [];

    if (period === "monthly") {
        const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);
        const completed = await earningsRepo.findCompletedSessionsSince(mentorId, startDate);

        const monthlyTotals = new Map();
        for (const r of completed) {
            const c = new Date(r.completedAt);
            const key = `${c.getFullYear()}-${c.getMonth()}`;
            monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + (r.totalAmount || 0));
        }

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            data.push({ label, amount: monthlyTotals.get(key) || 0 });
        }
    } else {
        const startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 55);
        const completed = await earningsRepo.findCompletedSessionsSince(mentorId, startDate);

        // AFTER — O(n) single pass, then O(1) per bucket
        // Build week boundaries first, then map each session to its bucket index
        const weekBoundaries = [];
        for (let i = 7; i >= 0; i--) {
            const weekStart = new Date(now);
            weekStart.setDate(weekStart.getDate() - i * 7);
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 7);
            weekBoundaries.push({ label: `W${8 - i}`, weekStart, weekEnd, amount: 0 });
        }

        for (const r of completed) {
            const c = new Date(r.completedAt);
            const bucket = weekBoundaries.find((b) => c >= b.weekStart && c < b.weekEnd);
            if (bucket) bucket.amount += r.totalAmount || 0;
        }

        data = weekBoundaries.map(({ label, amount }) => ({ label, amount }));
    }

    return { period, data };
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings/payouts?page=1&limit=10&search=
// ─────────────────────────────────────────────────────────────
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
            ? new Date(r.completedAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric",
            })
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

    return {
        payouts: rows,
        pagination: {
            totalCount,
            currentPage: safePage,
            totalPages: Math.ceil(totalCount / safeLimit),
            hasMore: safePage < Math.ceil(totalCount / safeLimit),
        },
    };
};

// ─────────────────────────────────────────────────────────────
// POST /api/mentor/earnings/withdraw
// ─────────────────────────────────────────────────────────────
const withdrawEarnings = async (mentorId) => {
    const wallet = await earningsRepo.findWalletDocument(mentorId);

    if (!wallet) {
        const err = new Error("Wallet not found");
        err.statusCode = 404;
        throw err;
    }
    if (wallet.balance <= 0) {
        const err = new Error("No balance available to withdraw");
        err.statusCode = 400;
        throw err;
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

    return {
        message: "Withdrawal request submitted successfully",
        withdrawn,
        newBalance: 0,
    };
};

module.exports = {
    getEarningsSummary,
    getEarningsChart,
    getPayoutHistory,
    withdrawEarnings,
};