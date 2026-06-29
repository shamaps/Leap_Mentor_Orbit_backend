// backend/repositories/escrow.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const AdminUser = require("../models/AdminUser");
const Availability = require("../models/Availability");
const MentorProfile = require("../models/MentorProfile");
const logger = require("../utils/logger");

// ─── Admin ────────────────────────────────────────────────────

/**
 * Pulls management tracking configs from administrative collections.
 * * @function findActiveAdmin
 * @returns {Promise<Object|null>} Active administration row criteria mapping variables.
 */
const findActiveAdmin = () =>
  AdminUser.findOne({ isActive: true }).select("commissionRate walletBalance");

/**
 * Modifies numerical treasury balances recording platform cut performance.
 * * @function creditAdmin
 * @param {any} adminId - Target admin user row locator index.
 * @param {number} amount - Collected commission fee added to treasury balance.
 * @param {any} [session] - Active transaction context boundary hook.
 * @returns {Promise<Object|null>} Original or altered state based on underlying update drivers.
 */
const creditAdmin = (adminId, amount, session) => {
  logger.debug("creditAdmin called", { adminId: adminId?.toString(), amount });
  return AdminUser.findByIdAndUpdate(
    adminId,
    { $inc: { walletBalance: amount } },
    session ? { session } : {}
  );
};

// ─── Connect Request ──────────────────────────────────────────

/**
 * Resolves fully populated interaction fields linked to user documents.
 * * @function findConnectRequestById
 * @param {string} id - Database row locator index key.
 * @param {any} [session] - Transaction context processing adapter.
 * @returns {Promise<Object|null>} Hydrated Mongoose entity model pointer or null.
 */
const findConnectRequestById = (id, session) =>
  ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .session(session);

/**
 * Reads compact telemetry arrays tracking historical status profiles.
 * * @function findConnectRequestByIdLean
 * @param {string} id - Row primary index indicator.
 * @returns {Promise<Object|null>} Dehydrated lean plain JavaScript representation object map.
 */
const findConnectRequestByIdLean = (id) =>
  ConnectRequest.findById(id)
    .select("mentee mentor status paymentStatus sessionRate sessionCount totalAmount paidAt completedAt confirmedSlot")
    .lean();

/**
 * Isolates unpopulated database rows ready for atomic parameter manipulation.
 * * @function findConnectRequestRaw
 * @param {string} id - Target identification index parameter.
 * @param {any} [session] - Mongoose interactive isolation block container context.
 * @returns {Promise<Object|null>} Live record structure template instance or null.
 */
const findConnectRequestRaw = (id, session) =>
  ConnectRequest.findById(id).session(session);

/**
 * Explicitly triggers document model save processes under established isolation limits.
 * * @function saveConnectRequest
 * @param {Object} connectRequest - Active instanced item document being written.
 * @param {any} [session] - Active database session tracking reference.
 * @returns {Promise<Object>} Persistence layer output results metadata.
 */
const saveConnectRequest = (connectRequest, session) =>
  connectRequest.save(session ? { session } : undefined);

// ─── Wallet ───────────────────────────────────────────────────

/**
 * Captures wallet information objects allowing resource adjustment.
 * * @function findWalletByUser
 * @param {any} userId - Target owner identifier index locator.
 * @param {any} [session] - Transaction connection interface adapter.
 * @returns {Promise<Object|null>} Full interactive Mongoose row document instance or null.
 */
const findWalletByUser = (userId, session) =>
  Wallet.findOne({ user: userId }).session(session);

/**
 * Optimized lookup returning exact numeric liquidity indicators.
 * * @function findWalletByUserLean
 * @param {any} userId - Lookup index criteria matching targeted parameters.
 * @returns {Promise<Object|null>} Un-instanced plain JavaScript map detailing balances.
 */
const findWalletByUserLean = (userId) =>
  Wallet.findOne({ user: userId }).select("balance escrow").lean();

/**
 * Commits structural alterations made on dynamic wallet records.
 * * @function saveWallet
 * @param {Object} wallet - Target model transaction structure block.
 * @param {any} [session] - Operational environment transaction link tracker.
 * @returns {Promise<Object>} Persistent save operation validation properties.
 */
const saveWallet = (wallet, session) =>
  wallet.save(session ? { session } : undefined);

// ─── Transaction ──────────────────────────────────────────────

/**
 * Implements batch insert routines recording structural audit logs under ACID constraints.
 * * @function createTransactions
 * @param {Object[]} docs - Formatted property packages tracking transaction records.
 * @param {any} [session] - Execution environment separation boundary context reference.
 * @returns {Promise<Object[]>} Arrays displaying successfully recorded elements parameters.
 */
const createTransactions = (docs, session) => {
  logger.debug("createTransactions called", { count: docs.length });
  return Transaction.insertMany(docs, { session, ordered: true });
};

// ─── Availability ─────────────────────────────────────────────

/**
 * Resolves location tags specific to the designated provider.
 * * @function findMentorTimezone
 * @param {any} mentorId - System user record pointer matching host criteria.
 * @returns {Promise<Object|null>} Lean parameters tracking timezone variables strings.
 */
const findMentorTimezone = (mentorId) =>
  Availability.findOne({ mentor: mentorId }).select("timezone").lean();

// ─── Mentor Profile ───────────────────────────────────────────

/**
 * Advances counter arrays logging total completed interactions.
 * * @function incrementMentorSessions
 * @param {any} mentorId - Host target primary profile identifier.
 * @param {any} [session] - Active database session tracking reference.
 * @returns {Promise<Object|null>} Database return parameters validating update metrics.
 */
const incrementMentorSessions = (mentorId, session) => {
  logger.debug("incrementMentorSessions called", { mentorId: mentorId?.toString() });
  return MentorProfile.findOneAndUpdate(
    { user: mentorId },
    { $inc: { totalSessions: 1 } },
    session ? { session } : {}
  );
};

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