// backend/controllers/earnings.controller.js
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile  = require("../models/MentorProfile");
const Wallet         = require("../models/Wallet");

const { logger } = require("@sentry/node");
// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings
// Stat cards — totalEarnings, sessionsThisMonth, avgRating, pendingPayout
// ─────────────────────────────────────────────────────────────
const getEarningsSummary = async (req, res) => {
  try {
    const mentorId = req.user._id;

    // All completed sessions for this mentor
    const completed = await ConnectRequest.find({
      mentor: mentorId,
      status: "completed",
    }).lean();

    // Total earnings — sum all totalAmount
    const totalEarnings = completed.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

    // Sessions this month
    const now       = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const sessionsThisMonth = completed.filter(
      (r) => r.completedAt && new Date(r.completedAt) >= monthStart
    ).length;

    // Average rating from MentorProfile
    const mentorProfile = await MentorProfile.findOne({ user: mentorId })
      .select("avgRating totalSessions")
      .lean();
    const avgRating = mentorProfile?.avgRating || 0;

    // Pending payout from wallet escrow
    // Pending payout — sum of mentorPayout from ongoing sessions
// (paid by mentee but not yet released to mentor)
const ongoingSessions = await ConnectRequest.find({
  mentor: mentorId,
  status: "ongoing",
  paymentStatus: "paid",
}).lean();

const pendingPayout = ongoingSessions.reduce(
  (sum, r) => sum + (r.mentorPayout || 0), 0
);

const wallet = await Wallet.findOne({ user: mentorId }).lean();

    logger.info("earnings.controller completed successfully");
    return res.json({
      success: true,
      totalEarnings,
      sessionsThisMonth,
      avgRating,
      pendingPayout,
      walletBalance: wallet?.balance || 0,
    });
  } catch (err) {
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings/chart?period=monthly|weekly
// Chart data — grouped earnings
// ─────────────────────────────────────────────────────────────
const getEarningsChart = async (req, res) => {
  try {
    const mentorId = req.user._id;
    const period   = req.query.period === "weekly" ? "weekly" : "monthly";

    const now = new Date();
    let startDate;
    let data = [];

    if (period === "monthly") {
      // Last 6 months
      startDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const completed = await ConnectRequest.find({
        mentor:      mentorId,
        status:      "completed",
        completedAt: { $gte: startDate },
      }).lean();

      // Build last 6 months array
      for (let i = 5; i >= 0; i--) {
        const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
        const amount = completed
          .filter((r) => {
            const c = new Date(r.completedAt);
            return c.getFullYear() === d.getFullYear() && c.getMonth() === d.getMonth();
          })
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
        data.push({ label, amount });
      }
    } else {
      // Last 8 weeks
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 55);

      const completed = await ConnectRequest.find({
        mentor:      mentorId,
        status:      "completed",
        completedAt: { $gte: startDate },
      }).lean();

      for (let i = 7; i >= 0; i--) {
        const weekStart = new Date(now);
        weekStart.setDate(weekStart.getDate() - i * 7);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);

        const label = `W${8 - i}`;
        const amount = completed
          .filter((r) => {
            const c = new Date(r.completedAt);
            return c >= weekStart && c < weekEnd;
          })
          .reduce((sum, r) => sum + (r.totalAmount || 0), 0);
        data.push({ label, amount });
      }
    }

    logger.info("earnings.controller completed successfully");
    return res.json({ success: true, period, data });
  } catch (err) {
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings/payouts?page=1&limit=10&search=
// Payout history table — paginated + searchable
// ─────────────────────────────────────────────────────────────
const getPayoutHistory = async (req, res) => {
  try {
    const mentorId = req.user._id;
    const page     = Math.max(1, Number.parseInt(req.query.page)  || 1);
    const limit    = Math.min(20, Number.parseInt(req.query.limit) || 10);
    const search   = req.query.search?.trim() || "";
    const skip     = (page - 1) * limit;

    // Base query
    let query = {
      mentor: mentorId,
      status: "completed",
    };

    // If searching by mentee name — get matching user IDs first
    if (search) {
      const User = require("../models/User");
      const matchingUsers = await User.find({
        name: { $regex: search, $options: "i" },
      }).select("_id").lean();
      const userIds = matchingUsers.map((u) => u._id);
      query.mentee = { $in: userIds };
    }

    const [totalCount, payouts] = await Promise.all([
      ConnectRequest.countDocuments(query),
      ConnectRequest.find(query)
        .populate("mentee", "name email")
        .select("mentee confirmedSlot totalAmount paymentStatus completedAt sessionCount sessionRate")
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    ]);

    // Format rows for frontend table
    const rows = payouts.map((r) => ({
      id:          r._id,
      date:        r.completedAt
        ? new Date(r.completedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
        : "—",
      menteeName:  r.mentee?.name  || "—",
      menteeEmail: r.mentee?.email || "—",
      sessionType: r.confirmedSlot?.day || "—",
      duration:    r.confirmedSlot
        ? (() => {
            const [sh, sm] = (r.confirmedSlot.startTime || "0:0").split(":").map(Number);
            const [eh, em] = (r.confirmedSlot.endTime   || "0:0").split(":").map(Number);
            const mins = (eh * 60 + em) - (sh * 60 + sm);
            return `${mins} mins`;
          })()
        : "—",
      amount:      r.totalAmount   || 0,
      status:      r.paymentStatus || "paid",
    }));

    logger.info("earnings.controller completed successfully");
    return res.json({
      success: true,
      payouts: rows,
      pagination: {
        totalCount,
        currentPage: page,
        totalPages:  Math.ceil(totalCount / limit),
        hasMore:     page < Math.ceil(totalCount / limit),
      },
    });
  } catch (err) {
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/mentor/earnings/withdraw
// Withdraw available balance
// ─────────────────────────────────────────────────────────────
const withdrawEarnings = async (req, res) => {
  try {
    const mentorId = req.user._id;
    const wallet   = await Wallet.findOne({ user: mentorId });

    if (!wallet) {
      return res.status(404).json({ message: "Wallet not found" });
    }
    if (wallet.balance <= 0) {
      return res.status(400).json({ message: "No balance available to withdraw" });
    }

    const withdrawn    = wallet.balance;
    wallet.balance     = 0;
    await wallet.save();

    const Transaction = require("../models/Transaction");
    await Transaction.create({
      user:         mentorId,
      type:         "withdrawal",
      amount:       withdrawn,
      description:  "Mentor withdrawal request",
      balanceAfter: 0,
    });

    logger.info("withdrawEarnings completed successfully");
    return res.json({
      success:    true,
      message:    "Withdrawal request submitted successfully",
      withdrawn,
      newBalance: 0,
    });
  } catch (err) {
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getEarningsSummary,
  getEarningsChart,
  getPayoutHistory,
  withdrawEarnings,
};