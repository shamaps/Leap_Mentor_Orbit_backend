// repositories/earnings.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile = require("../models/MentorProfile");
const Wallet = require("../models/Wallet");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { escapeRegex } = require("../utils/escapeRegex");

/**
 * Resolves static baseline evaluation metrics from target mentor profile.
 * * @function findMentorProfileStats
 * @param {string} mentorId - The query owner key string.
 * @returns {Promise<Object|null>} Lean Mongoose record properties or null.
 */
const findMentorProfileStats = (mentorId) =>
    MentorProfile.findOne({ user: mentorId }).select("avgRating totalSessions").lean();

/**
 * Extracts basic structural snapshot data explaining balance values.
 * * @function findWallet
 * @param {string} mentorId - Profile unique primary tracking index string.
 * @returns {Promise<Object|null>} Lean document object representing target account state.
 */
const findWallet = (mentorId) =>
    Wallet.findOne({ user: mentorId }).lean();

/**
 * Resolves complete arrays tracking interactions currently holding completed statuses.
 * * @function findCompletedSessions
 * @param {string} mentorId - Target lookup identifier criteria.
 * @returns {Promise<Object[]>} Collection detailing historic transactional values.
 */
const findCompletedSessions = (mentorId) =>
    ConnectRequest.find({ mentor: mentorId, status: "completed" })
        .select("totalAmount completedAt")
        .lean();

/**
 * Pulls open match connections where consumer capital capture has finalized successfully.
 * * @function findOngoingPaidSessions
 * @param {string} mentorId - Target account identifier reference string.
 * @returns {Promise<Object[]>} Active matching list elements tracking allocation values.
 */
const findOngoingPaidSessions = (mentorId) =>
    ConnectRequest.find({ mentor: mentorId, status: "ongoing", paymentStatus: "paid" })
        .select("mentorPayout")
        .lean();

/**
 * Timeline query filtering completed interactions passing selected date thresholds.
 * * @function findCompletedSessionsSince
 * @param {string} mentorId - Target profile matching argument context.
 * @param {Date} startDate - Opening index boundary parameter for calendar filtering.
 * @returns {Promise<Object[]>} Elements matching criteria sets.
 */
const findCompletedSessionsSince = (mentorId, startDate) =>
    ConnectRequest.find({
        mentor: mentorId,
        status: "completed",
        completedAt: { $gte: startDate },
    })
        .select("totalAmount completedAt")
        .lean();

/**
 * Wildcard query utilizing safe character conversions to return candidate identifiers.
 * * @function findUserIdsByName
 * @param {string} search - Input criteria text string.
 * @returns {Promise<Object[]>} Collection bounding match items capped at 200 elements.
 */
const findUserIdsByName = (search) =>
    User.find({ name: { $regex: escapeRegex(search), $options: "i" } }).select("_id").limit(200).lean();

/**
 * Resolves item density mapping count values from structured queries.
 * * @function countPayouts
 * @param {Object} query - Mongoose database filter statement criteria.
 * @returns {Promise<number>} Operational database record total match counts.
 */
const countPayouts = (query) => ConnectRequest.countDocuments(query);

/**
 * Returns structured paginated history details tracking resolved mentor distribution lines.
 * * @function findPayouts
 * @param {Object} query - Combined lookup properties checking constraints parameters.
 * @param {number} skip - Offset entry allocation parameter indicating item ignore counts.
 * @param {number} limit - Structural sizing definition parameter establishing output range density.
 * @returns {Promise<Object[]>} Sequential lean documents map array collections.
 */
const findPayouts = (query, skip, limit) =>
    ConnectRequest.find(query)
        .populate("mentee", "name email")
        .select("mentee confirmedSlot totalAmount paymentStatus completedAt sessionCount sessionRate")
        .sort({ completedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

/**
 * Selects an interactive Mongoose wallet instance allowing property modification and state preservation.
 * * @function findWalletDocument
 * @param {string} mentorId - Active profile identifier reference key string.
 * @returns {Promise<Object|null>} Full hydrated document layout or null.
 */
const findWalletDocument = (mentorId) =>
    Wallet.findOne({ user: mentorId });

/**
 * Appends audit logging structures tracing capital liquidity events.
 * * @function createTransaction
 * @param {Object} data - Audit tracking ledger properties configuration object.
 * @returns {Promise<Object>} Persisted transaction record validation confirmation.
 */
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