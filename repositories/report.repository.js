const Report = require("../models/Report");
const ConnectRequest = require("../models/ConnectRequest");

/**
 * Searches the ConnectRequest data model to select participant indexing references.
 * * @function findConnectRequestById
 * @param {string} id - Target selection locator primary index key string.
 * @returns {Promise<Object|null>} Lean document representation context layout blueprint, or null.
 */
const findConnectRequestById = (id) =>
    ConnectRequest.findById(id).select("mentee mentor").lean();

/**
 * Evaluates entry properties checking for overlapping historical duplicate configurations from a reporter user.
 * * @function findExistingReport
 * @param {string} connectRequestId - Dialogue pipeline lookup index key string.
 * @param {any} reportedById - Secure identity token verification signature checking ownership.
 * @returns {Promise<Object|null>} Limited single ID match pointer context envelope if true, else null.
 */
const findExistingReport = (connectRequestId, reportedById) =>
    Report.findOne({
        connectRequest: connectRequestId,
        reportedBy: reportedById,
    }).select("_id").lean();

/**
 * Creates and stores a fresh moderation report log subdocument mapping attributes.
 * * @function createReport
 * @param {Object} data - Schema constraints defined criteria object.
 * @returns {Promise<Object>} Freshly written database record model instance.
 */
const createReport = (data) => Report.create(data);

/**
 * Returns a reporter's filed complaint document based on composite criteria indicators.
 * * @function findReportByConnectAndUser
 * @param {string} connectRequestId - Associated target session checking locator query parameter.
 * @param {any} userId - Reference checking index parameters isolating report rows ownership.
 * @returns {Promise<Object|null>} Un-instanced plain JavaScript document snapshot representation data, or null.
 */
const findReportByConnectAndUser = (connectRequestId, userId) =>
    Report.findOne({
        connectRequest: connectRequestId,
        reportedBy: userId,
    }).lean();

/**
 * Resolves item density mapping count records matching administrative query filters criteria.
 * * @function countReports
 * @param {Object} filter - Traditional database check mapping statement configuration.
 * @returns {Promise<number>} Operational database total matching data indicators counts.
 */
const countReports = (filter) => Report.countDocuments(filter);

/**
 * Returns structured paginated summary details tracking recorded platform moderation lines.
 * * @function findReports
 * @param {Object} filter - Traditional database check mapping statement configuration.
 * @param {Object} pagination - Structural pagination limits parameters container.
 * @param {number} pagination.skip - Offset elements allocation counts.
 * @param {number} pagination.limit - Sizing threshold parameters defining range limit slices.
 * @returns {Promise<Object[]>} Descending sorted lean document parameter arrays fully populated.
 */
const findReports = (filter, { skip, limit }) =>
    Report.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email")
        .populate("connectRequest", "status totalAmount")
        .lean();

/**
 * Finds and executes in-place status parameter modifications on a single report row item.
 * * @function findReportByIdAndUpdate
 * @param {string} reportId - Primary database entry unique lookup selector index.
 * @param {Object} update - Delta updates package container holding terminal properties.
 * @returns {Promise<Object|null>} Fully mutated document layout returned populated model.
 */
const findReportByIdAndUpdate = (reportId, update) =>
    Report.findByIdAndUpdate(reportId, update, {
        new: true,
        runValidators: true,
    })
        .populate("reportedBy", "name email")
        .populate("reportedUser", "name email");

module.exports = {
    findConnectRequestById,
    findExistingReport,
    createReport,
    findReportByConnectAndUser,
    countReports,
    findReports,
    findReportByIdAndUpdate,
};