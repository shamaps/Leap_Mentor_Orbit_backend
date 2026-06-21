// services/message.service.js
const AppError = require("../utils/appError");
const createMessageService = (messageRepo, { logger }) => {
// GET /api/messages/:connectRequestId

const getMessages = async (connectRequestId, userId, query) => {
    const page = Math.max(1, Number.parseInt(query.page) || 1);
    const limit = Math.min(50, Number.parseInt(query.limit) || 30);
    const skip = (page - 1) * limit;

    const request = await messageRepo.findSessionParticipants(connectRequestId);
    if (!request) {
        throw new AppError(404, "Session not found");
    }

    const isMentor = request.mentor.toString() === userId;
    const isMentee = request.mentee.toString() === userId;
    if (!isMentor && !isMentee) {
        throw new AppError(403, "Not authorized to view these messages");
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


// GET /api/messages/:connectRequestId/unread-count

const getUnreadCount = async (connectRequestId, userId) => {
    const count = await messageRepo.countUnreadMessages(connectRequestId, userId);
    return { unreadCount: count };
};

return { getMessages, getUnreadCount };
};
module.exports = createMessageService;