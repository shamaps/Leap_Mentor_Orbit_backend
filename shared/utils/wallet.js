// utils/wallet.js
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const User = require("../models/User");
const { WELCOME_BONUS_LP } = require("../config/constants");
const logger = require("./logger");
const { idToString } = require("./idToString");
const { withTransaction } = require("./withTransaction");

/**
 * Returns the user's wallet, creating it on first use.
 *
 * Wallet creation is no longer part of registration: whichever flow first
 * needs a wallet calls this. A new wallet and its signup bonus are written
 * together, so either both exist or neither does.
 *
 * - Existing wallets are returned untouched (no bonus is ever re-issued).
 * - The bonus (WELCOME_BONUS_LP) is issued only when the user holds the
 *   "mentee" role at creation time. Its Transaction carries the key
 *   "<userId>:signup-bonus", enforced by a unique index.
 * - Safe to call concurrently: the loser of a creation race re-reads the
 *   winner's wallet.
 * - Returns null if the user does not exist (no orphan wallets).
 *
 * @param {import('mongoose').ObjectId|string} userId
 * @param {import('mongoose').ClientSession|null} [session] Caller's open
 *   transaction session, if any. When given, creation joins that transaction.
 * @returns {Promise<import('mongoose').Document|null>}
 */
const getOrCreateWallet = async (userId, session = null) => {
    const existing = await Wallet.findOne({ user: userId }).session(session);
    if (existing) return existing;

    const create = async (s) => {
        const user = await User.findById(userId).select("roles").session(s).lean();
        if (!user) return null;

        const isMentee = Array.isArray(user.roles) && user.roles.includes("mentee");
        const startingBalance = isMentee ? WELCOME_BONUS_LP : 0;

        const [wallet] = await Wallet.create(
            [{ user: userId, balance: startingBalance, escrow: 0 }],
            { session: s }
        );

        if (isMentee) {
            await Transaction.create(
                [{
                    user: userId,
                    type: "credit",
                    amount: WELCOME_BONUS_LP,
                    description: `Welcome bonus — ${WELCOME_BONUS_LP} points to get started`,
                    balanceAfter: WELCOME_BONUS_LP,
                    idempotencyKey: `${idToString(userId)}:signup-bonus`,
                }],
                { session: s }
            );
        }

        logger.info("Wallet created on first use", { userId: idToString(userId), isMentee, balance: startingBalance });
        return wallet;
    };

    // Inside the caller's transaction: join it. A concurrent creator surfaces as
    // a write conflict, which aborts the caller's transaction like any other
    // failed write; the request can simply be retried.
    if (session) return create(session);

    try {
        return await withTransaction(create, "wallet.getOrCreate");
    } catch (err) {
        // Lost a creation race (duplicate user, or transient write conflict):
        // the winner's wallet is now committed, so read it.
        const raced = await Wallet.findOne({ user: userId });
        if (raced) return raced;
        throw err;
    }
};

module.exports = { getOrCreateWallet };