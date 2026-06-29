// backend/repositories/adminPayments.repository.js
const Transaction = require("../models/Transaction");
const Wallet = require("../models/Wallet");
const ConnectRequest = require("../models/ConnectRequest");
const AdminUser = require("../models/AdminUser");
const { findUsersByName } = require("./userSearch.repository");

// STATS

/**
 * Finds the commission rate assigned to a specific admin.
 * @param {string} adminId - The ID of the admin user.
 * @returns {Promise<Object|null>} The admin document containing commissionRate.
 */
const findAdminCommissionRate = (adminId) =>
    AdminUser.findById(adminId).select("commissionRate").lean();

/**
 * Retrieves all successfully completed and paid connect requests.
 * @returns {Promise<Array<Object>>} Array of connect requests with totalAmount and commissionAmount.
 */
const findCompletedPaidSessions = () =>
    ConnectRequest.find({
        status: "completed",
        paymentStatus: "paid",
        totalAmount: { $gt: 0 },
    })
        .select("totalAmount commissionAmount")
        .lean();

/**
 * Calculates the total sum of all money currently held in escrow across all wallets.
 * @returns {Promise<Array<{_id: null, total: number}>>} Aggregation result containing total.
 */
const sumAllWalletEscrows = () =>
    Wallet.aggregate([
        { $group: { _id: null, total: { $sum: "$escrow" } } },
    ]);

/**
 * Counts the total number of refunded connect requests.
 * @returns {Promise<number>} Count of refunded requests.
 */
const countRefundedRequests = () =>
    ConnectRequest.countDocuments({ paymentStatus: "refunded" });


// CHART

/**
 * Finds completed sessions within a specific date range.
 * @param {Date} monthStart - The start date.
 * @param {Date} monthEnd - The end date.
 * @returns {Promise<Array<Object>>} Array of connect requests with totalAmount.
 */
const findCompletedSessionsInRange = (monthStart, monthEnd) =>
    ConnectRequest.find({
        status: "completed",
        completedAt: { $gte: monthStart, $lt: monthEnd },
    })
        .select("totalAmount")
        .lean();

/**
 * Finds all completed sessions from a specific start date to present.
 * @param {Date} startDate - The start date.
 * @returns {Promise<Array<Object>>} Array of connect requests with totalAmount and completedAt.
 */
const findCompletedSessionsSince = (startDate) =>
    ConnectRequest.find({
        status: "completed",
        completedAt: { $gte: startDate },
    })
        .select("totalAmount completedAt")
        .lean();

// TRANSACTIONS

/**
 * Finds user ObjectIDs matching a search term using Atlas Search.
 * @param {string} search - The user name to search for.
 * @returns {Promise<Array<string>>} Array of user IDs.
 */
const findUserIdsByName = async (search) => {
    const users = await findUsersByName(search, { includeDeleted: true });
    return users.map((u) => u._id);
};

/**
 * Counts the total number of transactions matching a filter.
 * @param {Object} filter - Mongoose query filter.
 * @returns {Promise<number>} Total count.
 */
const countTransactions = (filter) =>
    Transaction.countDocuments(filter);

/**
 * Retrieves a paginated list of transactions, populated with user info.
 * @param {Object} filter - Mongoose query filter.
 * @param {number} skip - Number of items to skip.
 * @param {number} limit - Maximum number of items to return.
 * @returns {Promise<Array<Object>>} Array of populated transaction documents.
 */
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
    sumAllWalletEscrows,
    countRefundedRequests,
    // chart
    findCompletedSessionsInRange,
    findCompletedSessionsSince,
    findUserIdsByName,
    countTransactions,
    findTransactions,
};