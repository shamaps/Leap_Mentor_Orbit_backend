// repositories/register.repository.js
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");

const findUserByEmail = (normalizedEmail) =>
    User.findOne({ email: normalizedEmail });

const saveUser = (user) =>
    user.save();

const createUser = (data) =>
    User.create(data);

const findWalletByUserAndRole = (userId, role) =>
    Wallet.findOne({ user: userId, role });

const createWallet = (data) =>
    Wallet.create(data);

const createTransaction = (data) =>
    Transaction.create(data);

module.exports = {
    findUserByEmail,
    saveUser,
    createUser,
    findWalletByUserAndRole,
    createWallet,
    createTransaction,
};