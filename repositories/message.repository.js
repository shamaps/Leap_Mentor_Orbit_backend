// repositories/message.repository.js
const Message = require("../models/Message");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

/**
 * Searches ConnectRequest elements returning basic participant indexing references.
 * * @function findSessionParticipants
 * @param {string} connectRequestId - Target selection locator primary index key string.
 * @returns {Promise<SessionParticipantsConfig|null>} Lean document parameters model structure configuration, or null.
 */
const findSessionParticipants = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee status")
        .lean();

// ─── Message ─────────────────────────────────────────────────

/**
 * Executes old-to-new sequential list pagination extractions using standard skip dimensions offsets.
 * * @function findMessages
 * @param {string} connectRequestId - Dynamic selection lookup match tracker identifier.
 * @param {number} skip - Offset elements boundary configuration parameters.
 * @param {number} limit - Sizing threshold parameters defining range limit slices.
 * @returns {Promise<Object[]>} Plain JavaScript document arrays populated with sender descriptions.
 */
const findMessages = (connectRequestId, skip, limit) =>
    Message.find({ connectRequest: connectRequestId })
        .populate("sender", "name email")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

/**
 * Queries chronological entries descending from a specific message indicator point for loading earlier data chunks.
 * * @function findMessagesByCursor
 * @param {string} connectRequestId - Channel selector check index reference key.
 * @param {string|null} beforeId - Target primary index selector tracking upper boundary limits.
 * @param {number} [limit=30] - Capacity sizing limit threshold configuration parameter tracking page sizes.
 * @returns {Promise<Object[]>} Newest-first sorted lean document parameter arrays.
 */
const findMessagesByCursor = (connectRequestId, beforeId, limit = 30) => {
    const filter = { connectRequest: connectRequestId };
    if (beforeId) filter._id = { $lt: beforeId };

    return Message.find(filter)
        .populate("sender", "name email")
        .sort({ _id: -1 })   // newest first, client reverses for display
        .limit(limit)
        .lean();
};

/**
 * Aggregates complete volume parameters of tracking entries bound inside specified dialogue tunnels.
 * * @function countMessages
 * @param {string} connectRequestId - Unique primary lookup index tracker string.
 * @returns {Promise<number>} Operational database total matching data indicators counts.
 */
const countMessages = (connectRequestId) =>
    Message.countDocuments({ connectRequest: connectRequestId });

/**
 * Updates status properties, flagging incoming items received from external conversation partners as viewed.
 * * @function markMessagesAsRead
 * @param {string} connectRequestId - Associated unique target platform channel index indicator.
 * @param {string} userId - Active processing caller identity parameter identifier.
 * @returns {Promise<Object>} MongoDB bulk write summary metrics tracking rows updated counts.
 */
const markMessagesAsRead = (connectRequestId, userId) =>
    Message.updateMany(
        { connectRequest: connectRequestId, sender: { $ne: userId }, readAt: null },
        { $set: { readAt: new Date() } }
    );

/**
 * Counts the current amount of unviewed items sent from opposing dialogue members.
 * * @function countUnreadMessages
 * @param {string} connectRequestId - Selected lookup identifier search parameter context.
 * @param {string} userId - Reference checking index parameters ensuring sender fields are omitted.
 * @returns {Promise<number>} Outstanding notification badge counts variables integers.
 */
const countUnreadMessages = (connectRequestId, userId) =>
    Message.countDocuments({
        connectRequest: connectRequestId,
        sender: { $ne: userId },
        readAt: null,
    });

module.exports = {
    findSessionParticipants,
    findMessages,
    countMessages,
    findMessagesByCursor,
    markMessagesAsRead,
    countUnreadMessages,
};