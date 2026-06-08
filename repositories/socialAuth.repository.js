const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");

const findOAuthAccount = (provider, providerId) =>
    OAuthAccount.findOne({ provider, providerId }).populate("user");

const findUserByEmail = (normalizedEmail) =>
    User.findOne({ email: normalizedEmail });

const createUser = (userData) => User.create(userData);

const createOAuthAccount = (userId, provider, providerId) =>
    OAuthAccount.create({ user: userId, provider, providerId });

module.exports = {
    findOAuthAccount,
    findUserByEmail,
    createUser,
    createOAuthAccount,
};