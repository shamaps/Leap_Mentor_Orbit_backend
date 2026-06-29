// utils/withTransaction.js
const mongoose = require("mongoose");
const logger = require("./logger");

/**
 * Wraps a function in a MongoDB transaction.
 * Automatically starts, commits, aborts, and ends the session.
 *
 * @param {Function} fn - async (session) => result
 * @param {string} context - label for logging
 * @returns {Promise<*>} result of fn
 *
 * @example
 * const result = await withTransaction(async (session) => {
 *   const wallet = await Wallet.findOne({ user: userId }).session(session);
 *   wallet.balance -= amount;
 *   await wallet.save({ session });
 *   return wallet;
 * }, "escrow.pay");
 */
const withTransaction = async (fn, context = "unknown") => {
    const session = await mongoose.startSession();
    session.startTransaction();
    try {
        const result = await fn(session);
        await session.commitTransaction();
        logger.info(`[${context}] transaction committed`);
        return result;
    } catch (err) {
        try {
            await session.abortTransaction();
            logger.warn(`[${context}] transaction aborted`, { error: err.message });
        } catch (abortErr) {
            logger.warn(`[${context}] abortTransaction failed`, { error: abortErr.message });
        }
        throw err;
    } finally {
        session.endSession();
    }
};

module.exports = { withTransaction };