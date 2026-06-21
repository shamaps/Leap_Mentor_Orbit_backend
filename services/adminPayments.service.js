// backend/services/adminPayments.service.js
const { DEFAULT_COMMISSION_RATE } = require("../config/constants");

const createAdminPaymentsService = (repo, { logger }) => {

// Pure helper — resolves transaction status without nested ternaries

const resolveTransactionStatus = (type) => {
    if (type === "escrow_refund") return "refunded";
    if (type === "escrow_hold") return "pending";
    if (type === "withdrawal") return "pending";
    return "completed";
};


// STATS

const fetchPaymentStats = async (adminId) => {
    const adminUser = await repo.findAdminCommissionRate(adminId);
    const commissionRate = adminUser?.commissionRate ?? DEFAULT_COMMISSION_RATE;

    const completedSessions = await repo.findCompletedPaidSessions();

    const totalRevenue = completedSessions.reduce(
        (s, r) => s + (r.totalAmount || 0),
        0,
    );

    const platformCommission = completedSessions.reduce(
        (s, r) => s + (r.commissionAmount || 0),
        0,
    );

    const [escrowResult] = await repo.sumAllWalletEscrows();
    const pendingPayouts = escrowResult?.total || 0;
    
    const refundedRequests = await repo.countRefundedRequests();

    return {
        totalRevenue,
        platformCommission,
        commissionRate,
        pendingPayouts,
        refundedRequests,
    };
};

// CHART

// AFTER — 1 DB query
const fetchRevenueChart = async () => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    // Single query for all 6 months
    const completed = await repo.findCompletedSessionsSince(startDate);

    // Group into monthly buckets with a Map — O(n) single pass
    const monthlyTotals = new Map();
    for (const r of completed) {
        const c = new Date(r.completedAt);
        const key = `${c.getFullYear()}-${c.getMonth()}`;
        monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + (r.totalAmount || 0));
    }

    const data = [];
    for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        data.push({ label, amount: monthlyTotals.get(key) || 0 });
    }

    return data;
};

// TRANSACTIONS

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

    return { fetchPaymentStats, fetchRevenueChart, fetchTransactions };
};
module.exports = createAdminPaymentsService;