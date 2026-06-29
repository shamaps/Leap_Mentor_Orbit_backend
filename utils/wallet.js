// utils/wallet.js
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { WELCOME_BONUS_LP } = require("../config/constants");
const logger = require("../utils/logger");

/**
 * Creates a wallet and, for mentees, a welcome-bonus transaction.
 * Accepts a single role string ("mentee"/"mentor") or an array of roles.
 * Throws if wallet/transaction creation fails — caller decides whether
 * that should be fatal (see clerkSSO.service.js for non-fatal wrapping).
 * @param {import('mongoose').ObjectId} userId
 * @param {string|string[]} roles
 * @returns {Promise<import('mongoose').Document>} the created wallet
 */
const provisionWallet = async (userId, roles) => {
    const roleArr = Array.isArray(roles) ? roles : [roles];
    const isMentee = roleArr.includes("mentee");
    const startingBalance = isMentee ? WELCOME_BONUS_LP : 0;

    const wallet = await Wallet.create({ user: userId, balance: startingBalance, escrow: 0 });
    logger.info("Wallet provisioned", { userId: userId.toString(), isMentee, balance: startingBalance });

    if (isMentee) {
        await Transaction.create({
            user: userId,
            type: "credit",
            amount: WELCOME_BONUS_LP,
            description: `Welcome bonus — ${WELCOME_BONUS_LP} points to get started`,
            balanceAfter: WELCOME_BONUS_LP,
        });
    }

    return wallet;
};

module.exports = { provisionWallet };
