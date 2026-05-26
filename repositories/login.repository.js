const User = require("../models/User");
const { logger } = require("@sentry/node");

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