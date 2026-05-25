// backend/repositories/adminPayments.repository.js
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const ConnectRequest = require("../models/ConnectRequest");
const AdminUser = require("../models/AdminUser");
const User = require("../models/User");

// ─────────────────────────────────────────────────────────────
// STATS
// ─────────────────────────────────────────────────────────────

const findAdminCommissionRate = (adminId) =>
    AdminUser.findById(adminId).select("commissionRate").lean();

const findCompletedPaidSessions = () =>
    ConnectRequest.find({
        status: "completed",
        paymentStatus: "paid",
        totalAmount: { $gt: 0 },
    })
        .select("totalAmount commissionAmount")
        .lean();

const findAllWalletEscrows = () =>
    Wallet.find().select("escrow").lean();

const countRefundedRequests = () =>
    ConnectRequest.countDocuments({ paymentStatus: "refunded" });

// ─────────────────────────────────────────────────────────────
// CHART
// ─────────────────────────────────────────────────────────────

const findCompletedSessionsInRange = (monthStart, monthEnd) =>
    ConnectRequest.find({
        status: "completed",
        completedAt: { $gte: monthStart, $lt: monthEnd },
    })
        .select("totalAmount")
        .lean();

// ─────────────────────────────────────────────────────────────
// TRANSACTIONS
// ─────────────────────────────────────────────────────────────

const findUserIdsByName = async (search) => {
    const users = await User.find({
        name: { $regex: search, $options: "i" },
    })
        .select("_id")
        .lean();
    return users.map((u) => u._id);
};

const countTransactions = (filter) =>
    Transaction.countDocuments(filter);

const findTransactions = (filter, skip, limit) =>
    Transaction.find(filter)
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

module.exports = {
    // stats
    findAdminCommissionRate,
    findCompletedPaidSessions,
    findAllWalletEscrows,
    countRefundedRequests,
    // chart
    findCompletedSessionsInRange,
    // transactions
    findUserIdsByName,
    countTransactions,
    findTransactions,
};