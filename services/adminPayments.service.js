// backend/services/adminPayments.service.js
const repo = require("../repositories/adminPayments.repository");

const { logger } = require("@sentry/node");
// ─────────────────────────────────────────────────────────────
// Pure helper — resolves transaction status without nested ternaries
// ─────────────────────────────────────────────────────────────
const resolveTransactionStatus = (type) => {
    if (type === "escrow_refund") return "refunded";
    if (type === "escrow_hold") return "pending";
    if (type === "withdrawal") return "pending";
    return "completed";
};

// ─────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────

const fetchPaymentStats = async (adminId) => {
    const adminUser = await repo.findAdminCommissionRate(adminId);
    const commissionRate = adminUser?.commissionRate ?? 20;

    const completedSessions = await repo.findCompletedPaidSessions();

    const totalRevenue = completedSessions.reduce(
        (s, r) => s + (r.totalAmount || 0),
        0,
    );

    const platformCommission = completedSessions.reduce(
        (s, r) => s + (r.commissionAmount || 0),
        0,
    );

    const wallets = await repo.findAllWalletEscrows();
    const pendingPayouts = wallets.reduce((s, w) => s + (w.escrow || 0), 0);

    const refundedRequests = await repo.countRefundedRequests();

    return {
        totalRevenue,
        platformCommission,
        commissionRate,
        pendingPayouts,
        refundedRequests,
    };
};

// ─────────────────────────────────────────────────────────────
// CHART
// ─────────────────────────────────────────────────────────────

const fetchRevenueChart = async () => {
    const now = new Date();
    const data = [];

    for (let i = 5; i >= 0; i--) {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
        const label = monthStart
            .toLocaleString("en-US", { month: "short" })
            .toUpperCase();

        const sessions = await repo.findCompletedSessionsInRange(monthStart, monthEnd);
        const amount = sessions.reduce((s, r) => s + (r.totalAmount || 0), 0);

        data.push({ label, amount });
    }

    return data;
};

// ─────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────

const fetchTransactions = async ({ page, limit, search, type }) => {
    const skip = (page - 1) * limit;
    const filter = {};

    if (search) {
        const userIds = await repo.findUserIdsByName(search);
        filter.user = { $in: userIds };
    }

    if (type) {
        filter.type = type;
    } else {
        filter.type = { $ne: "credit" }; // hide welcome-bonus credits by default
    }

    const [totalCount, transactions] = await Promise.all([
        repo.countTransactions(filter),
        repo.findTransactions(filter, skip, limit),
    ]);

    const rows = transactions.map((t) => ({
        id: t._id,
        txId: `#TRX-${String(t._id).slice(-5).toUpperCase()}`,
        user: { name: t.user?.name || "—", email: t.user?.email || "—" },
        amount: t.amount || 0,
        type: t.type || "—",
        description: t.description || "—",
        date: t.createdAt
            ? new Date(t.createdAt).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            })
            : "—",
        // FIX: extracted nested ternary into resolveTransactionStatus()
        status: resolveTransactionStatus(t.type),
    }));

    return {
        transactions: rows,
        pagination: {
            totalCount,
            currentPage: page,
            totalPages: Math.ceil(totalCount / limit),
            hasMore: page < Math.ceil(totalCount / limit),
        },
    };
};

module.exports = {
    fetchPaymentStats,
    fetchRevenueChart,
    fetchTransactions,
};