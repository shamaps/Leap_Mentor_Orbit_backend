// repositories/leapRequest.repository.js

/**
 * @fileoverview Data-access layer for LeapRequest and its associated Wallet operations.
 * All Mongoose queries are isolated here; the service layer never touches
 * models directly.
 *
 * @module repositories/leapRequest
 */

const LeapRequest = require("../models/LeapRequest");
const Wallet = require("../models/Wallet");

// ─── LeapRequest ─────────────────────────────────────────────

/**
 * Find the most-recent pending request for a mentee.
 * Returns the latest document by `createdAt` descending (there should
 * normally be at most one pending request per mentee at a time).
 *
 * @param {mongoose.Types.ObjectId|string} menteeId
 * @returns {Promise<import('../models/LeapRequest').LeapRequestDoc|null>}
 */
const findPendingByMentee = (menteeId) =>
    LeapRequest.findOne({ mentee: menteeId, status: "pending" }).sort({ createdAt: -1 });

/**
 * Find any single pending request for a mentee (existence check).
 * Used to enforce the one-pending-request-at-a-time constraint before
 * creating a new request. Unlike `findPendingByMentee`, no sort is applied.
 *
 * @param {mongoose.Types.ObjectId|string} menteeId
 * @returns {Promise<import('../models/LeapRequest').LeapRequestDoc|null>}
 */
const findPendingByMenteeOne = (menteeId) =>
    LeapRequest.findOne({ mentee: menteeId, status: "pending" });

/**
 * Create a new LeapRequest document.
 *
 * @param {{ mentee: mongoose.Types.ObjectId|string, currentBalance: number }} data
 * @returns {Promise<import('../models/LeapRequest').LeapRequestDoc>}
 */
const createRequest = (data) =>
    LeapRequest.create(data);

/**
 * Return a page of all LeapRequests, sorted newest-first by `_id`.
 * Uses cursor-style pagination via `afterId` (ObjectId `$lt` comparison)
 * when provided, falling back to a full scan when `afterId` is `null`.
 *
 * Note: the `skip` parameter name is used by the caller (service) but is
 * passed as `afterId` here — the repository treats any truthy value as a
 * cursor and falsy as "start from the beginning".
 *
 * @param {string|null} [afterId=null] - Exclusive upper-bound ObjectId for cursor pagination
 * @param {number}      [limit=50]     - Maximum number of documents to return
 * @returns {Promise<Object[]>} Lean LeapRequest objects with `mentee` (name, email, profilePicture) populated
 */
const findAllRequests = (afterId = null, limit = 50) =>
    LeapRequest.find(afterId ? { _id: { $lt: afterId } } : {})
        .populate("mentee", "name email profilePicture")
        .sort({ _id: -1 })
        .limit(limit)
        .lean();

/**
 * Count the total number of LeapRequest documents (all statuses).
 * Used alongside `findAllRequests` to compute pagination metadata.
 *
 * @returns {Promise<number>}
 */
const countAllRequests = () => LeapRequest.countDocuments();

/**
 * Count only pending LeapRequest documents.
 * Used to populate the admin sidebar badge.
 *
 * @returns {Promise<number>}
 */
const countPendingRequests = () =>
    LeapRequest.countDocuments({ status: "pending" });

/**
 * Find a single LeapRequest by its document ID.
 * Returns a mutable Mongoose document (for status updates and `.save()`).
 *
 * @param {string} id - LeapRequest `_id`
 * @returns {Promise<import('../models/LeapRequest').LeapRequestDoc|null>}
 */
const findRequestById = (id) =>
    LeapRequest.findById(id);

// ─── Wallet ──────────────────────────────────────────────────

/**
 * Find a mentee's wallet document.
 * Returns a mutable Mongoose document; `null` if no wallet exists yet.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<import('../models/Wallet').WalletDoc|null>}
 */
const findWalletByUser = (userId) =>
    Wallet.findOne({ user: userId });

/**
 * Atomically increment a mentee's wallet balance by `amount` LP.
 * Creates the wallet document if it does not yet exist (upsert).
 *
 * @param {mongoose.Types.ObjectId|string} menteeId
 * @param {number} amount - Number of Leap Points to add (use a negative value to deduct)
 * @returns {Promise<import('../models/Wallet').WalletDoc>} The updated wallet document
 */
const incrementWalletBalance = (menteeId, amount) =>
    Wallet.findOneAndUpdate(
        { user: menteeId },
        { $inc: { balance: amount } },
        { new: true, upsert: true }
    );

module.exports = {
    findPendingByMentee,
    findPendingByMenteeOne,
    createRequest,
    countAllRequests,
    findAllRequests,
    countPendingRequests,
    findRequestById,
    findWalletByUser,
    incrementWalletBalance,
};