// repositories/earnings.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile = require("../models/MentorProfile");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { escapeRegex } = require("../utils/escapeRegex");

// Summary 

const findMentorProfileStats = (mentorId) =>
    MentorProfile.findOne({ user: mentorId }).select("avgRating totalSessions").lean();

const findWallet = (mentorId) =>
    Wallet.findOne({ user: mentorId }).lean();

const findCompletedSessions = (mentorId) =>
    ConnectRequest.find({ mentor: mentorId, status: "completed" })
        .select("totalAmount completedAt")
        .lean();

const findOngoingPaidSessions = (mentorId) =>
    ConnectRequest.find({ mentor: mentorId, status: "ongoing", paymentStatus: "paid" })
        .select("mentorPayout")
        .lean();
//Chart
const findCompletedSessionsSince = (mentorId, startDate) =>
    ConnectRequest.find({
        mentor: mentorId,
        status: "completed",
        completedAt: { $gte: startDate },
    })
        .select("totalAmount completedAt")
        .lean();


// Payout history 

const findUserIdsByName = (search) =>
    User.find({ name: { $regex: escapeRegex(search), $options: "i" } }).select("_id").limit(200).lean();
const countPayouts = (query) => ConnectRequest.countDocuments(query);

const findPayouts = (query, skip, limit) =>
    ConnectRequest.find(query)
        .populate("mentee", "name email")
        .select("mentee confirmedSlot totalAmount paymentStatus completedAt sessionCount sessionRate")
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

// Withdraw 

const findWalletDocument = (mentorId) =>
    Wallet.findOne({ user: mentorId });

const createTransaction = (data) => Transaction.create(data);

module.exports = {
    findCompletedSessions,
    findMentorProfileStats,
    findOngoingPaidSessions,
    findWallet,
    findCompletedSessionsSince,
    findUserIdsByName,
    countPayouts,
    findPayouts,
    findWalletDocument,
    createTransaction,
};