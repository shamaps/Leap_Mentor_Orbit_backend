// repositories/googleAuth.repository.js
const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

/**
 * Find a user by email.
 * @param {string} email - already normalized (lowercase + trimmed)
 */
const findUserByEmail = async (email) => {
    return await User.findOne({ email });
};

/**
 * Create a new user.
 * @param {Object} data
 */
const createUser = async (data) => {
    return await User.create(data);
};

/**
 * Save changes to an existing user document.
 * @param {Document} user
 */
const saveUser = async (user) => {
    return await user.save();
};

/**
 * Create a wallet for a new user.
 * @param {ObjectId} userId
 * @param {number}   balance - starting balance
 */
const createWallet = async (userId, balance) => {
    return await Wallet.create({ user: userId, balance, escrow: 0 });
};

/**
 * Create a welcome bonus transaction for mentees.
 * @param {ObjectId} userId
 */
const createWelcomeTransaction = async (userId) => {
    return await Transaction.create({
        user: userId,
        type: "credit",
        amount: 500,
        description: "Welcome bonus — 500 points to get started",
        balanceAfter: 500,
    });
};

/**
 * Find an existing OAuth account by provider + providerId.
 * @param {string} provider   - e.g. "google"
 * @param {string} providerId - Google sub
 */
const findOAuthAccount = async (provider, providerId) => {
    return await OAuthAccount.findOne({ provider, providerId });
};

/**
 * Create an OAuth account link between user and provider.
 * @param {ObjectId} userId
 * @param {string}   provider
 * @param {string}   providerId
 */
const createOAuthAccount = async (userId, provider, providerId) => {
    return await OAuthAccount.create({ user: userId, provider, providerId });
};

module.exports = {
    findUserByEmail,
    createUser,
    saveUser,
    createWallet,
    createWelcomeTransaction,
    findOAuthAccount,
    createOAuthAccount,
};