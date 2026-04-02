// backend/controllers/admin/adminPayments.controller.js
const Transaction = require("../../models/Transaction");
const Wallet = require("../../models/Wallet");
const ConnectRequest = require("../../models/ConnectRequest");
const AdminUser = require("../../models/AdminUser");
const User = require("../../models/User");

// ─────────────────────────────────────────────────────────────
// GET /api/admin/payments/stats
// ─────────────────────────────────────────────────────────────
const getPaymentStats = async (req, res) => {
  try {
    // ✅ FIX 1 — use authenticated admin's ID, not findOne({ isActive: true })
    const adminUser = await AdminUser.findById(req.admin._id)
      .select("commissionRate")
      .lean();
    const commissionRate = adminUser?.commissionRate ?? 20;

    const completedSessions = await ConnectRequest.find({
      status: "completed",
      paymentStatus: "paid",
      totalAmount: { $gt: 0 },
    })
      .select("totalAmount commissionAmount")
      .lean();

    // Total revenue — full amount paid by mentee across all completed sessions
    const totalRevenue = completedSessions.reduce(
      (s, r) => s + (r.totalAmount || 0),
      0,
    );

    // ✅ FIX 2 — sum commissionAmount directly from ConnectRequest snapshot
    // Avoids incorrect values if commission rate was changed after sessions completed
    const platformCommission = completedSessions.reduce(
      (s, r) => s + (r.commissionAmount || 0),
      0,
    );

    const wallets = await Wallet.find().select("escrow").lean();
    const pendingPayouts = wallets.reduce((s, w) => s + (w.escrow || 0), 0);

    const refundedRequests = await ConnectRequest.countDocuments({
      paymentStatus: "refunded",
    });

    // ✅ FIX 3 — commissionRate removed from response
    return res.json({
      success: true,
      totalRevenue,
      platformCommission,
      pendingPayouts,
      refundedRequests,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/payments/chart
// ─────────────────────────────────────────────────────────────
const getRevenueChart = async (req, res) => {
  try {
    const now = new Date();
    const data = [];

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const label = monthStart
        .toLocaleString("en-US", { month: "short" })
        .toUpperCase();

      const sessions = await ConnectRequest.find({
        status: "completed",
        completedAt: { $gte: monthStart, $lt: monthEnd },
      })
        .select("totalAmount")
        .lean();

      const amount = sessions.reduce((s, r) => s + (r.totalAmount || 0), 0);
      data.push({ label, amount });
    }

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/payments/transactions
// ─────────────────────────────────────────────────────────────
const getTransactions = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(20, parseInt(req.query.limit) || 10);
    const search = req.query.search?.trim() || "";
    const type = req.query.type?.trim() || "";
    const skip = (page - 1) * limit;

    const filter = {};

    if (search) {
      const matchingUsers = await User.find({
        name: { $regex: search, $options: "i" },
      })
        .select("_id")
        .lean();
      filter.user = { $in: matchingUsers.map((u) => u._id) };
    }

    if (type) {
      filter.type = type;
    } else {
      // Hide welcome bonus credits by default
      filter.type = { $ne: "credit" };
    }

    const [totalCount, transactions] = await Promise.all([
      Transaction.countDocuments(filter),
      Transaction.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
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
      status:
        t.type === "escrow_refund"
          ? "refunded"
          : t.type === "escrow_hold"
            ? "pending"
            : t.type === "withdrawal"
              ? "pending"
              : "completed",
    }));

    return res.json({
      success: true,
      transactions: rows,
      pagination: {
        totalCount,
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page < Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { getPaymentStats, getRevenueChart, getTransactions };
