// repositories/googleAuth.repository.js
const User = require("@leapmentor/shared/models/User");
const OAuthAccount = require("@leapmentor/shared/models/OAuthAccount");

/**
 * Searches for a User record exactly matching the provided pre-normalized email address.
 * * @function findUserByEmail
 * @param {string} email - Case-insensitive email address query criteria.
 * @returns {Promise<Object|null>} Found Mongoose tracking user document model or null.
 */
const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

/**
 * Registers a new user entry document layout within system persistence stores.
 * * @function createUser
 * @param {Object} data - Schema criteria mapped properties tracking user registration attributes.
 * @returns {Promise<Object>} Fully instantiated Mongoose document row.
 */
const createUser = async (data) => {
    return await User.create(data);
};

/**
 * Persists parameter changes or dynamic capabilities additions on an active User document model.
 * * @function saveUser
 * @param {Object} user - Hydrated database document instance model being written.
 * @returns {Promise<Object>} Persistent save operation validation properties.
 */
const saveUser = async (user) => {
    return await user.save();
};

/**
 * Searches for a federated linking relationship mapping matching specified credential combinations.
 * * @function findOAuthAccount
 * @param {string} provider - Canonical provider system identifier name tag (e.g., "google").
 * @param {string} providerId - Upstream remote origin source identification tracking index value.
 * @returns {Promise<Object|null>} Linked document metadata entity block or null.
 */
const findOAuthAccount = async (provider, providerId) => {
    return await OAuthAccount.findOne({ provider, providerId });
};

/**
 * Connects an internal user registry index with an external third-party provider identity token statement.
 * * @function createOAuthAccount
 * @param {any} userId - Target reference locator indicator linking platform basic users.
 * @param {string} provider - Federation channel label key string.
 * @param {string} providerId - Upstream unique identity user reference string metadata.
 * @returns {Promise<Object>} Formed integration linking verification parameters documentation.
 */
const createOAuthAccount = async (userId, provider, providerId) => {
    return await OAuthAccount.create({ user: userId, provider, providerId });
};

module.exports = {
    findUserByEmail,
    createUser,
    saveUser,
    findOAuthAccount,
    createOAuthAccount,
};