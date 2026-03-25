// backend/repositories/escrow.repository.js
const mongoose       = require("mongoose");
const ConnectRequest = require("../models/ConnectRequest");
const Wallet         = require("../models/Wallet");
const Transaction    = require("../models/Transaction");
const AdminUser      = require("../models/AdminUser");
const Availability   = require("../models/Availability");
const MentorProfile  = require("../models/MentorProfile");

// ─── Admin 
const findActiveAdmin = () =>
  AdminUser.findOne({ isActive: true }).select("commissionRate walletBalance");

const creditAdmin = (adminId, amount) =>
  AdminUser.findByIdAndUpdate(adminId, { $inc: { walletBalance: amount } });

// ─── Connect Request ──────────────────────────────────────────
const findConnectRequestById = (id, session) =>
  ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .session(session);

const findConnectRequestByIdLean = (id) =>
  ConnectRequest.findById(id)
    .select("mentee mentor status paymentStatus sessionRate sessionCount totalAmount paidAt completedAt confirmedSlot")
    .lean();

const findConnectRequestRaw = (id, session) =>
  ConnectRequest.findById(id).session(session);

const saveConnectRequest = (connectRequest, session) =>
  connectRequest.save(session ? { session } : undefined);

// ─── Wallet 
const findWalletByUser = (userId, session) =>
  Wallet.findOne({ user: userId }).session(session);

const findWalletByUserLean = (userId) =>
  Wallet.findOne({ user: userId }).select("balance escrow").lean();

const saveWallet = (wallet, session) =>
  wallet.save(session ? { session } : undefined);

// ─── Transaction 
const createTransactions = (docs, session) =>
  Transaction.create(docs, { session });

// ─── Availability 
const findMentorTimezone = (mentorId) =>
  Availability.findOne({ mentor: mentorId }).select("timezone").lean();

// ─── Mentor Profile 
const incrementMentorSessions = (mentorId) =>
  MentorProfile.findOneAndUpdate({ user: mentorId }, { $inc: { totalSessions: 1 } });

module.exports = {
  findActiveAdmin,
  creditAdmin,
  findConnectRequestById,
  findConnectRequestByIdLean,
  findConnectRequestRaw,
  saveConnectRequest,
  findWalletByUser,
  findWalletByUserLean,
  saveWallet,
  createTransactions,
  findMentorTimezone,
  incrementMentorSessions,
};