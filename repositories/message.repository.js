// repositories/message.repository.js
const Message = require("../models/Message");
const ConnectRequest = require("../models/ConnectRequest");

// ─── ConnectRequest ──────────────────────────────────────────

const findSessionParticipants = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee status")
        .lean();

// ─── Message ─────────────────────────────────────────────────

const findMessages = (connectRequestId, skip, limit) =>
    Message.find({ connectRequest: connectRequestId })
        .populate("sender", "name email")
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean();

const countMessages = (connectRequestId) =>
    Message.countDocuments({ connectRequest: connectRequestId });

const markMessagesAsRead = (connectRequestId, userId) =>
    Message.updateMany(
        { connectRequest: connectRequestId, sender: { $ne: userId }, readAt: null },
        { $set: { readAt: new Date() } }
    );

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
    markMessagesAsRead,
    countUnreadMessages,
};