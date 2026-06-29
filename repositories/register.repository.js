// repositories/register.repository.js
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const logger = require("../utils/logger");

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

/**
 * Checks for localized financial structures linking unique users with custom profile capabilities.
 * * @function findWalletByUserAndRole
 * @param {any} userId - Target primary account owner unique indicator locator key.
 * @param {string} role - Access scope literal identifier checking constraints mapping.
 * @returns {Promise<Object|null>} Found matching ledger row instance, else null.
 */
const findWalletByUserAndRole = (userId, role) =>
    Wallet.findOne({ user: userId, role });

/**
 * Allocates fresh ledger entries initialized against specific user capability pairs.
 * * @function createWallet
 * @param {Object} data - Context layout blueprint tracking structural wallet indicators.
 * @returns {Promise<Object>} Initialized written model data document tracker record.
 */
const createWallet = (data) => {
    logger.debug("createWallet called", { userId: data.user?.toString(), role: data.role });
    return Wallet.create(data);
};

/**
 * Logs introductory promotional ledger velocity tracking records within audit streams.
 * * @function createTransaction
 * @param {Object} data - Audit tracking parameters payload configurations.
 * @returns {Promise<Object>} Persisted transaction validation confirmation data model.
 */
const createTransaction = (data) => {
    logger.debug("createTransaction called", { userId: data.user?.toString(), type: data.type });
    return Transaction.create(data);
};

module.exports = {
    findUserByEmail,
    saveUser,
    createUser,
    findWalletByUserAndRole,
    createWallet,
    createTransaction,
};