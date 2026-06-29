// repositories/verification.repository.js
const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");

/**
 * Queries the core User model to locate entries exactly matching normalized, parsed email string fields.
 * * @function findUserByEmail
 * @param {string} email - Raw target character kontakt route address criteria.
 * @returns {import('mongoose').Query} Mongoose selection pipeline context mapping targets.
 */
const findUserByEmail = (email) =>
    User.findOne({ email: String(email).toLowerCase().trim() });

/**
 * Modifies account status columns, committing email authorization visibility flags to true.
 * * @async
 * @function markEmailVerified
 * @param {Object} user - Hydrated Mongoose operational document mapping profile variables.
 * @returns {Promise<Object>} Saved model write operational verification configurations details.
 */
const markEmailVerified = async (user) => {
    user.isEmailVerified = true;
    return user.save();
};

/**
 * Discards unexpired or obsolete verification token groupings related to a single user primary index.
 * * @function deleteTokensByUser
 * @param {any} userId - Target primary account locator index indicator key string.
 * @returns {import('mongoose').Query} MongoDB bulk write summary metrics tracking rows updated counts.
 */
const deleteTokensByUser = (userId) =>
    VerificationToken.deleteMany({ user: userId });

/**
 * Commits a fresh pair mapping programmatic passcode and link hashes onto data collections.
 * * @function createVerificationToken
 * @param {Object} data - Schema constraints verified criteria configuration properties container.
 * @returns {Promise<Object>} Newly written Mongoose verification document instance return.
 */
const createVerificationToken = (data) => VerificationToken.create(data);

/**
 * Pulls open verification transaction logs details matching specified recipient user indices.
 * * @function findTokenByUser
 * @param {any} userId - Selected target lookup identifier search parameter context.
 * @returns {import('mongoose').Query} Un-instanced schema tracking pointer context envelope or null.
 */
const findTokenByUser = (userId) =>
    VerificationToken.findOne({ user: userId });

module.exports = {
    findUserByEmail,
    markEmailVerified,
    deleteTokensByUser,
    createVerificationToken,
    findTokenByUser,
};