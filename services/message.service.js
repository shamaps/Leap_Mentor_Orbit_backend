// services/message.service.js
const messageRepo = require("../repositories/message.repository");

const { logger } = require("@sentry/node");
// ─────────────────────────────────────────────────────────────
// GET /api/messages/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getMessages = async (connectRequestId, userId, query) => {
    const page = Math.max(1, Number.parseInt(query.page) || 1);
    const limit = Math.min(50, Number.parseInt(query.limit) || 30);
    const skip = (page - 1) * limit;

    const request = await messageRepo.findSessionParticipants(connectRequestId);
    if (!request) {
        const err = new Error("Session not found");
        err.statusCode = 404;
        throw err;
    }

    const isMentor = request.mentor.toString() === userId;
    const isMentee = request.mentee.toString() === userId;
    if (!isMentor && !isMentee) {
        const err = new Error("Not authorized to view these messages");
        err.statusCode = 403;
        throw err;
    }

    const [messages, totalCount] = await Promise.all([
        messageRepo.findMessages(connectRequestId, skip, limit),
        messageRepo.countMessages(connectRequestId),
    ]);

    // Mark fetched messages as read if receiver is fetching
    await messageRepo.markMessagesAsRead(connectRequestId, userId);

    return {
        messages,
        totalCount,
        page,
        limit,
        hasMore: skip + messages.length < totalCount,
    };
};

// ─────────────────────────────────────────────────────────────
// GET /api/messages/:connectRequestId/unread-count
// ─────────────────────────────────────────────────────────────
const getUnreadCount = async (connectRequestId, userId) => {
    const count = await messageRepo.countUnreadMessages(connectRequestId, userId);
    return { unreadCount: count };
};

module.exports = { getMessages, getUnreadCount };