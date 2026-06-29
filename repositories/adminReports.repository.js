// backend/repositories/adminReports.repository.js
const Report = require("../models/Report");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const ConnectRequest = require("../models/ConnectRequest");
const { findUsersByName } = require("./userSearch.repository");

// STATS

/**
 * Counts the total number of all reports.
 * @returns {Promise<number>}
 */
const countAllReports = () =>
    Report.countDocuments();

/**
 * Counts reports that are currently open or under review.
 * @returns {Promise<number>}
 */
const countPendingReports = () =>
    Report.countDocuments({ status: { $in: ["open", "under_review"] } });

/**
 * Counts reports resolved from the start of the specified day.
 * @param {Date} today - Start of the current day.
 * @returns {Promise<number>}
 */
const countResolvedToday = (today) =>
    Report.countDocuments({ status: "resolved", resolvedAt: { $gte: today } });

// LIST

/**
 * Searches for users by name and returns their IDs.
 * @param {string} search - Search query.
 * @returns {Promise<Array<string>>} Array of ObjectIds.
 */
const findUserIdsByName = async (search) => {
    const users = await findUsersByName(search, { includeDeleted: true });
    return users.map((u) => u._id);
};

/**
 * Finds specific skills and industry for a mentor profile.
 * @param {string} userId - ID of the user.
 * @returns {Promise<Object|null>} Mentor profile data.
 */
const findMyProfileSkills = (userId) =>
    MentorProfile.findOne({ user: userId })
        .select("skills industry")
        .lean();

/**
 * Counts reports based on a given filter.
 * @param {Object} filter - Mongoose query filter.
 * @returns {Promise<number>}
 */
const countReports = (filter) =>
    Report.countDocuments(filter);

/**
 * Fetches a paginated, populated list of reports.
 * @param {Object} filter - Mongoose query filter.
 * @param {number} skip - Pagination skip count.
 * @param {number} limit - Maximum number of items.
 * @returns {Promise<Array<Object>>} Array of report documents.
 */
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

/**
 * Fetches a single report by ID populated with reporter and reported user details.
 * @param {string} id - Report ID.
 * @returns {Promise<Object|null>} Report document.
 */
const findReportById = (id) =>
    Report.findById(id)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email");

/**
 * Fetches a single report by ID including associated session (connectRequest) details.
 * @param {string} id - Report ID.
 * @returns {Promise<Object|null>} Report document.
 */
const findReportByIdWithSession = (id) =>
    Report.findById(id)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email")
        .populate("connectRequest", "status paymentStatus totalAmount sessionRate sessionCount mentee mentor completedAt paidAt");

/**
 * Fetches a single report, its session, and populated participants (mentee and mentor).
 * @param {string} id - Report ID.
 * @returns {Promise<Object|null>} Deeply populated report document.
 */
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

/**
 * Saves changes to a report document.
 * @param {Object} report - Mongoose report document.
 * @returns {Promise<Object>} Saved document.
 */
const saveReport = (report) =>
    report.save();

// REFUND

/**
 * Finds a wallet document belonging to a specific mentee.
 * @param {string} menteeId - Mentee user ID.
 * @returns {Promise<Object|null>} Wallet document.
 */
const findMenteeWallet = (menteeId) =>
    Wallet.findOne({ user: menteeId });

/**
 * Saves changes to a wallet document.
 * @param {Object} wallet - Mongoose wallet document.
 * @returns {Promise<Object>} Saved document.
 */
const saveWallet = (wallet) =>
    wallet.save();

/**
 * Creates a new transaction record in the database.
 * @param {Object} data - Transaction details.
 * @returns {Promise<Object>} Created transaction document.
 */
const createRefundTransaction = (data) =>
    Transaction.create(data);

/**
 * Saves changes to a ConnectRequest (session) document.
 * @param {Object} connectRequest - Mongoose connect request document.
 * @returns {Promise<Object>} Saved document.
 */
const saveConnectRequest = (connectRequest) =>
    connectRequest.save();

// DELETE SESSION

/**
 * Deletes a ConnectRequest by its ID.
 * @param {string} id - ConnectRequest ID.
 * @returns {Promise<Object|null>} Deleted document.
 */
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
    findMyProfileSkills,
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