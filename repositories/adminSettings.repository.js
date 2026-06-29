// repositories/adminSettings.repository.js
const AdminUser = require("../models/AdminUser");
const User = require("../models/User");
const ConnectRequest = require("../models/ConnectRequest");

// ─── Overview ────────────────────────────────────────────────

/**
 * Counts the total number of registration records in the database.
 * * @function countTotalUsers
 * @returns {Promise<number>} Resolution of total user collection count.
 */
const countTotalUsers = () => User.countDocuments();

/**
 * Counts all session requests currently running in an ongoing status.
 * * @function countActiveSessions
 * @returns {Promise<number>} Active tracking record counts.
 */
const countActiveSessions = () =>
    ConnectRequest.countDocuments({ status: "ongoing" });

// ─── Admin document ──────────────────────────────────────────

/**
 * Retrieves the full MongoDB document structure for a specific Admin ID.
 * * @function findAdminDocumentById
 * @param {string} adminId - The unique identifier string.
 * @returns {Promise<Object|null>} Hydrated Mongoose document instance or null if not found.
 */
const findAdminDocumentById = (adminId) => AdminUser.findById(adminId);

/**
 * Performance-optimized extraction containing only the commission percentage setup.
 * * @function findAdminCommissionById
 * @param {string} adminId - Target administrator primary key.
 * @returns {Promise<{ commissionRate?: number }|null>} Plain JavaScript object or null.
 */
const findAdminCommissionById = (adminId) =>
    AdminUser.findById(adminId).select("commissionRate").lean();

// ─── Admin mutations ─────────────────────────────────────────

/**
 * Locates an admin by their normalized email string.
 * * @function findAdminByEmail
 * @param {string} normalizedEmail - Processed case-insensitive email address.
 * @returns {Promise<Object|null>} Found record pointer or null.
 */
const findAdminByEmail = (normalizedEmail) =>
    AdminUser.findOne({ email: normalizedEmail });

/**
 * Executes persistence layer registration of a new administrator profile.
 * * @function createAdmin
 * @param {Object} data - Schema properties matching creation specifications.
 * @returns {Promise<Object>} The instanced Mongoose model return from insertion.
 */
const createAdmin = (data) => AdminUser.create(data);

/**
 * Directly alters numerical platform cut for a single administrative unit.
 * * @function updateCommissionRate
 * @param {string} adminId - Target profile modifier index key.
 * @param {number} rate - Calculated floating or int percent limit config.
 * @returns {Promise<Object|null>} Original or updated structural state based on setup.
 */
const updateCommissionRate = (adminId, rate) =>
    AdminUser.findByIdAndUpdate(adminId, { commissionRate: rate });

module.exports = {
    countTotalUsers,
    countActiveSessions,
    findAdminDocumentById,
    findAdminCommissionById,
    findAdminByEmail,
    createAdmin,
    updateCommissionRate,
};