// repositories/forgotPassword.repository.js
const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");
const logger = require("../utils/logger");
// ─────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────

/**
 * Find a user by normalized (lowercase + trimmed) email.
 * @param {string} normalizedEmail
 */
const findUserByEmail = async (normalizedEmail) => {
    return await User.findOne({ email: normalizedEmail });
};

/**
 * Save changes to a user document (e.g. new hashed password).
 * @param {Document} user
 */
const saveUser = async (user) => {
    return await user.save();
};

// ─────────────────────────────────────────────────────────────
// VERIFICATION TOKEN
// ─────────────────────────────────────────────────────────────

/**
 * Find the active OTP record for a given user.
 * @param {ObjectId} userId
 */
const findTokenByUser = async (userId) => {
    return await VerificationToken.findOne({ user: userId });
};

/**
 * Delete all OTP records for a user.
 * Called before creating a new OTP and after password reset.
 * @param {ObjectId} userId
 */
const deleteTokensByUser = async (userId) => {
    logger.debug("deleteTokensByUser called", { userId: userId?.toString() });
    return await VerificationToken.deleteMany({ user: userId });
};


/**
 * Create a new OTP record.
 * @param {Object} data
 * @param {ObjectId} data.userId
 * @param {string}   data.otpHash   - bcrypt hash of the plain OTP
 * @param {Date}     data.expiresAt
 */
const createToken = async ({ userId, otpHash, expiresAt }) => {
    logger.debug("createToken called", { userId: userId?.toString() });
    return await VerificationToken.create({ user: userId, otp: otpHash, expiresAt });
};

/**
 * Save changes to an existing token document (e.g. extending expiry).
 * @param {Document} record
 */
const saveToken = async (record) => {
    return await record.save();
};

module.exports = {
    findUserByEmail,
    saveUser,
    findTokenByUser,
    deleteTokensByUser,
    createToken,
    saveToken,
};