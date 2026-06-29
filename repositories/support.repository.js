// repositories/support.repository.js
const SupportMessage = require("../models/SupportMessage");
const Notification = require("../models/Notification");
const User = require("../models/User");

/**
 * Creates and stores a fresh SupportMessage database record document.
 * * @function createSupportMessage
 * @param {Object} data - Schema constraints verified configuration data variables.
 * @returns {Promise<Object>} Newly written Mongoose row data context return.
 */
const createSupportMessage = (data) => SupportMessage.create(data);

/**
 * Returns a sorted collection array containing support logs rows, newest first.
 * * @function findAllMessages
 * @param {number} [skip=0] - Pagination offset parameter managing item ignore counts.
 * @param {number} [limit=50] - Sizing window parameters establishing output range boundaries.
 * @returns {Promise<Object[]>} Plain JavaScript document array representation parameters sorted descending.
 */
const findAllMessages = (skip = 0, limit = 50) =>
    SupportMessage.find()
        .select("email subject message role status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

/**
 * Calculates absolute count indicators tracking system-wide logged tickets.
 * * @function countMessages
 * @returns {Promise<number>} Operational database total records items count integer.
 */
const countMessages = () => SupportMessage.countDocuments();

/**
 * Dynamic modification executor overwriting state columns to mark standard tickets resolved.
 * * @function resolveMessageById
 * @param {string} id - Target selection locator primary index key string.
 * @returns {Promise<Object|null>} Fully mutated document layout returned confirmation model.
 */
const resolveMessageById = (id) =>
    SupportMessage.findByIdAndUpdate(id, { status: "resolved" }, { new: true });

/**
 * Searches the core User model to locate matching account identifiers relative to contact addresses.
 * * @function findUserByEmail
 * @param {string} email - Case-insensitive processed target search locator.
 * @returns {Promise<Object|null>} Found Mongoose user row model instance or null.
 */
const findUserByEmail = (email) => User.findOne({ email });

/**
 * Records a new structural notification parameter envelope row onto data registers.
 * * @function createNotification
 * @param {Object} data - Context layout blueprint tracking structural notification indicators.
 * @returns {Promise<Object>} Freshly instantiated written Mongoose document row.
 */
const createNotification = (data) => Notification.create(data);

module.exports = {
    createSupportMessage,
    findAllMessages,
    countMessages,
    resolveMessageById,
    findUserByEmail,
    createNotification,
};