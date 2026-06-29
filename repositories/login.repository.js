const User = require("../models/User");
const logger = require("../utils/logger");

/**
 * Searches user records based on normalized email criteria, explicitly allowing matches on soft-deleted rows.
 * * @async
 * @function findUserByEmail
 * @param {string} email - Case-insensitive processed target address string.
 * @throws {Error} Relays low-level Mongoose exceptions following trace tracking injections.
 * @returns {Promise<Object|null>} Found Mongoose user row document model instance or null.
 */
const findUserByEmail = async (email) => {
    try {
        return await User.findOne({ email }).setOptions({ ignoreIsDeleted: true });
    } catch (err) {
        // ✅ DB-level failure — rare but important to catch
        logger.error("DB error in findUserByEmail", { email, error: err.message });
        throw err;
    }
};

module.exports = { findUserByEmail };