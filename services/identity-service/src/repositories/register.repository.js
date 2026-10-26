// repositories/register.repository.js
const User = require("@leapmentor/shared/models/User");
const logger = require("@leapmentor/shared/utils/logger");

/**
 * Searches the core User model to locate entries exactly matching a normalized email query criterion.
 * * @function findUserByEmail
 * @param {string} normalizedEmail - Case-insensitive processed target address string identifier.
 * @returns {Promise<Object|null>} Found Mongoose tracking user document instance model or null.
 */
const findUserByEmail = (normalizedEmail) =>
    User.findOne({ email: normalizedEmail });

/**
 * Explicit save operation wrapping standard record mutation persistence loops.
 * * @function saveUser
 * @param {Object} user - Hydrated Mongoose operational document mapping properties.
 * @returns {Promise<Object>} Persisted document confirmation resolution details.
 */
const saveUser = (user) =>
    user.save();

/**
 * Commits a brand-new user identity record configuration onto persistent stores.
 * * @function createUser
 * @param {Object} data - Schema criteria mapped properties tracking initial onboarding parameters.
 * @returns {Promise<Object>} Fully instantiated fresh Mongoose document row model.
 */
const createUser = (data) => {
    logger.debug("createUser called", { email: data.email, roles: data.roles });
    return User.create(data);
};

module.exports = {
    findUserByEmail,
    saveUser,
    createUser,
};