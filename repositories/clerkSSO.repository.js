// backend/repositories/clerkSSO.repository.js
const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const findUserByEmail = (email) =>
    User.findOne({ email });

const createUser = (data) =>
    User.create(data);

const saveUser = (user) =>
    user.save();

const findOAuthAccount = (provider, providerId) =>
    OAuthAccount.findOne({ provider, providerId });

const createOAuthAccount = (data) =>
    OAuthAccount.create(data);

const createWallet = (data) =>
    Wallet.create(data);

const createTransaction = (data) =>
    Transaction.create(data);

module.exports = {
    findUserByEmail,
    createUser,
    saveUser,
    findOAuthAccount,
    createOAuthAccount,
    createWallet,
    createTransaction,
};