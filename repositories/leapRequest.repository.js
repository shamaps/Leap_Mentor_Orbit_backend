// repositories/leapRequest.repository.js
const LeapRequest = require("../models/LeapRequest");
const Wallet = require("../models/Wallet");

// ─── LeapRequest ─────────────────────────────────────────────

const findPendingByMentee = (menteeId) =>
    LeapRequest.findOne({ mentee: menteeId, status: "pending" }).sort({ createdAt: -1 });

const findPendingByMenteeOne = (menteeId) =>
    LeapRequest.findOne({ mentee: menteeId, status: "pending" });

const createRequest = (data) =>
    LeapRequest.create(data);

const findAllRequests = () =>
    LeapRequest.find()
        .populate("mentee", "name email profilePicture")
        .sort({ createdAt: -1 });

const countPendingRequests = () =>
    LeapRequest.countDocuments({ status: "pending" });

const findRequestById = (id) =>
    LeapRequest.findById(id);

// ─── Wallet ──────────────────────────────────────────────────

const findWalletByUser = (userId) =>
    Wallet.findOne({ user: userId });

const incrementWalletBalance = (menteeId, amount) =>
    Wallet.findOneAndUpdate(
        { user: menteeId },
        { $inc: { balance: amount } },
        { new: true, upsert: true }
    );

module.exports = {
    findPendingByMentee,
    findPendingByMenteeOne,
    createRequest,
    findAllRequests,
    countPendingRequests,
    findRequestById,
    findWalletByUser,
    incrementWalletBalance,
};