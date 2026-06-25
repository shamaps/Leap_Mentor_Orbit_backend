// services/message.service.js
const AppError = require("../utils/appError");
const { toMessageListDTO, toUnreadCountDTO } = require("../utils/mappers/message.mapper");
const createMessageService = (messageRepo, { logger }) => {
    // GET /api/messages/:connectRequestId
    const getMessages = async (connectRequestId, userId, query) => {
        const limit = Math.min(50, Number.parseInt(query.limit) || 30);
        const before = query.before || null;

        const request = await messageRepo.findSessionParticipants(connectRequestId);
        if (!request) {
            throw new AppError(404, "Session not found");
        }

        const isMentor = request.mentor.toString() === userId;
        const isMentee = request.mentee.toString() === userId;
        if (!isMentor && !isMentee) {
            throw new AppError(403, "Not authorized to view these messages");
        }

        // Mark messages as read regardless of pagination mode
        await messageRepo.markMessagesAsRead(connectRequestId, userId);

        // Cursor-based — for infinite scroll / load more
        if (before) {
            const messages = await messageRepo.findMessagesByCursor(connectRequestId, before, limit);
            return toMessageListDTO({ messages: messages.reverse(), pagination: { mode: "cursor", hasMore: messages.length === limit } });
        }

        // Offset-based — for initial load
        const page = Math.max(1, Number.parseInt(query.page) || 1);
        const skip = (page - 1) * limit;

        const [messages, totalCount] = await Promise.all([
            messageRepo.findMessages(connectRequestId, skip, limit),
            messageRepo.countMessages(connectRequestId),
        ]);

        return toMessageListDTO({ messages, totalCount, page, limit, hasMore: skip + messages.length < totalCount });
    };


    // GET /api/messages/:connectRequestId/unread-count

    const getUnreadCount = async (connectRequestId, userId) => {
        const count = await messageRepo.countUnreadMessages(connectRequestId, userId);
        return toUnreadCountDTO(count);
    };

    return { getMessages, getUnreadCount };
};
module.exports = createMessageService;