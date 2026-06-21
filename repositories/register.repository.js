// repositories/register.repository.js
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const logger = require("../utils/logger");
const findUserByEmail = (normalizedEmail) =>
    User.findOne({ email: normalizedEmail });

const saveUser = (user) =>
    user.save();

const createUser = (data) => {
    logger.debug("createUser called", { email: data.email, roles: data.roles });
    return User.create(data);
};

const findWalletByUserAndRole = (userId, role) =>
    Wallet.findOne({ user: userId, role });

const createWallet = (data) => {
    logger.debug("createWallet called", { userId: data.user?.toString(), role: data.role });
    return Wallet.create(data);
};
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