// backend/repositories/adminReports.repository.js
const Report = require("../models/Report");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const ConnectRequest = require("../models/ConnectRequest");
const { escapeRegex } = require("../utils/escapeRegex");

// STATS
const countAllReports = () =>
    Report.countDocuments();

const countPendingReports = () =>
    Report.countDocuments({ status: { $in: ["open", "under_review"] } });

const countResolvedToday = (today) =>
    Report.countDocuments({ status: "resolved", resolvedAt: { $gte: today } });

// LIST
const findUserIdsByName = async (search) => {
    const users = await User.find({
        name: { $regex: escapeRegex(search), $options: "i" },
    })
        .select("_id")
        .lean();
    return users.map((u) => u._id);
};

const countReports = (filter) =>
    Report.countDocuments(filter);

const findReports = (filter, skip, limit) =>
    Report.find(filter)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email")
        .populate("connectRequest", "status paymentStatus totalAmount sessionRate sessionCount mentee mentor")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

// SINGLE REPORT
const findReportById = (id) =>
    Report.findById(id)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email");

const findReportByIdWithSession = (id) =>
    Report.findById(id)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email")
        .populate("connectRequest");

const findReportByIdWithSessionAndParticipants = (id) =>
    Report.findById(id)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email")
        .populate({
            path: "connectRequest",
            populate: [
                { path: "mentee", select: "name email" },
                { path: "mentor", select: "name email" },
            ],
        });

const saveReport = (report) =>
    report.save();

// REFUND
const findMenteeWallet = (menteeId) =>
    Wallet.findOne({ user: menteeId });

const saveWallet = (wallet) =>
    wallet.save();

const createRefundTransaction = (data) =>
    Transaction.create(data);

const saveConnectRequest = (connectRequest) =>
    connectRequest.save();

// DELETE SESSION
const deleteConnectRequestById = (id) =>
    ConnectRequest.findByIdAndDelete(id);

module.exports = {
    // stats
    countAllReports,
    countPendingReports,
    countResolvedToday,
    // list
    findUserIdsByName,
    countReports,
    findReports,
    // single
    findReportById,
    findReportByIdWithSession,
    findReportByIdWithSessionAndParticipants,
    saveReport,
    // refund
    findMenteeWallet,
    saveWallet,
    createRefundTransaction,
    saveConnectRequest,
    // delete
    deleteConnectRequestById,
};