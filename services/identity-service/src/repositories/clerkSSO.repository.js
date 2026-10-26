// backend/repositories/clerkSSO.repository.js
const User = require("@leapmentor/shared/models/User");
const OAuthAccount = require("@leapmentor/shared/models/OAuthAccount");

/**
 * Checks User records based on target email identifier string.
 * * @function findUserByEmail
 * @param {string} email - Destination address lookup parameter string.
 * @returns {Promise<Object|null>} Found Mongoose tracking instance model or null.
 */
const findUserByEmail = (email) =>
    User.findOne({ email });

/**
 * Registers user identity documents on the database.
 * * @function createUser
 * @param {Object} data - Schema criteria mapped properties tracking user credentials.
 * @returns {Promise<Object>} Created model record documentation mapping.
 */
const createUser = (data) =>
    User.create(data);

/**
 * Explicit save operation wrapping standard record mutation updates persistence loops.
 * * @function saveUser
 * @param {Object} user - Hydrated Mongoose operational document mapping properties.
 * @returns {Promise<Object>} Persisted document confirmation resolution details.
 */
const saveUser = (user) =>
    user.save();

/**
 * Searches federated provider linkage entities matching composite criteria indexes.
 * * @function findOAuthAccount
 * @param {string} provider - Federation channel name string identifier key.
 * @param {string} providerId - Upstream third-party origin user index pointer value.
 * @returns {Promise<Object|null>} Linked document metadata entity block, else null.
 */
const findOAuthAccount = (provider, providerId) =>
    OAuthAccount.findOne({ provider, providerId });

/**
 * Stores federation record linkages between platform user entries and upstream identity assertions.
 * * @function createOAuthAccount
 * @param {Object} data - Schema context parameters map.
 * @param {any} data.user - Target reference indicator linking basic user entities.
 * @param {string} data.provider - Canonical provider reference key string.
 * @param {string} data.providerId - Upstream unique identity reference string metadata.
 * @returns {Promise<Object>} Formed integration document structural verification parameters.
 */
const createOAuthAccount = (data) =>
    OAuthAccount.create(data);

module.exports = {
    findUserByEmail,
    createUser,
    saveUser,
    findOAuthAccount,
    createOAuthAccount,
};