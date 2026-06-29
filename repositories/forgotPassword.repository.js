// repositories/forgotPassword.repository.js
const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");
const logger = require("../utils/logger");

/**
 * Searches user records based on normalized email criteria.
 * * @function findUserByEmail
 * @param {string} normalizedEmail - Processed case-insensitive target search locator.
 * @returns {Promise<Object|null>} Found Mongoose user row model instance or null.
 */
const findUserByEmail = async (normalizedEmail) => {
    return await User.findOne({ email: normalizedEmail });
};

/**
 * Persists entity credential structural modifications back to core records.
 * * @function saveUser
 * @param {Object} user - Hydrated database document instance model.
 * @returns {Promise<Object>} Execution database persistence resolution summary.
 */
const saveUser = async (user) => {
    return await user.save();
};

/**
 * Locates outstanding active transient security records matching target accounts.
 * * @function findTokenByUser
 * @param {any} userId - Target primary index locator tracking account owners.
 * @returns {Promise<VerificationTokenDocument|null>} Matching structural token record details or null.
 */
const findTokenByUser = async (userId) => {
    return await VerificationToken.findOne({ user: userId });
};

/**
 * Evicts active security tracking components linked to targeted profile indices.
 * * @function deleteTokensByUser
 * @param {any} userId - Account tracking locator argument pointer.
 * @returns {Promise<Object>} Operational metrics confirming record clearance counts.
 */
const deleteTokensByUser = async (userId) => {
    logger.debug("deleteTokensByUser called", { userId: userId?.toString() });
    return await VerificationToken.deleteMany({ user: userId });
};

/**
 * Instantiates fresh workflow tokens capturing transient verification metrics.
 * * @function createToken
 * @param {Object} initializationData - Creation requirements criteria properties.
 * @param {any} initializationData.userId - Target primary account owner locator index.
 * @param {string} initializationData.otpHash - Hashed evaluation sequence verification string.
 * @param {Date} initializationData.expiresAt - Target terminal validation lifespan timestamp.
 * @returns {Promise<Object>} Newly constructed database verification entity document.
 */
const createToken = async ({ userId, otpHash, expiresAt }) => {
    logger.debug("createToken called", { userId: userId?.toString() });
    return await VerificationToken.create({ user: userId, otp: otpHash, expiresAt });
};

/**
 * Commits temporal updates altering structural tokens lifespans.
 * * @function saveToken
 * @param {VerificationTokenDocument} record - Active tracking subdocument model template.
 * @returns {Promise<Object>} Saved confirmation verification response values.
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