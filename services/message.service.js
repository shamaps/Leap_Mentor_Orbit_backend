// services/message.service.js
const AppError = require("../utils/appError");
const { toMessageListDTO, toUnreadCountDTO } = require("../utils/mappers/message.mapper");

/**
 * @typedef {Object} SessionParticipantsConfig
 * @property {any} mentor - Unique user identifier tracking the mentor on the session.
 * @property {any} mentee - Unique user identifier tracking the mentee on the session.
 * @property {string} status - Platform operational state string for the connection request.
 */

/**
 * @typedef {Object} MessageRepository
 * @property {(connectRequestId: string) => Promise<SessionParticipantsConfig|null>} findSessionParticipants - Resolves participant indices.
 * @property {(connectRequestId: string, skip: number, limit: number) => Promise<Object[]>} findMessages - Standard chronological pagination query.
 * @property {(connectRequestId: string) => Promise<number>} countMessages - Tracks total volume messages in a session.
 * @property {(connectRequestId: string, beforeId: string, limit?: number) => Promise<Object[]>} findMessagesByCursor - Queries historical entries relative to a specific message ID cursor.
 * @property {(connectRequestId: string, userId: string) => Promise<Object>} markMessagesAsRead - Flags unread items received from the conversation partner.
 * @property {(connectRequestId: string, userId: string) => Promise<number>} countUnreadMessages - Quantifies outstanding inbound items.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs routine execution telemetry.
 * @property {(message: string, error: any) => void} error - Traces operational error logs.
 */

/**
 * Factory function constructing the core Messaging Service infrastructure.
 * * @param {MessageRepository} messageRepo - Database abstraction layer data registry instance.
 * @param {{ logger: Logger }} dependencies - Application performance metric capture monitoring tool.
 * @returns {Object} Configured object map exposing conversation reporting methods.
 */
const createMessageService = (messageRepo, { logger }) => {

    /**
     * Resolves messaging history blocks under either a traditional offset pattern or dynamic cursor infinite scrolls.
     * Flags outstanding incoming items as read concurrently.
     * * @async
     * @function getMessages
     * @param {string} connectRequestId - Target conversation pipeline lookup unique indicator key string.
     * @param {string} userId - Authenticated actor user reference identifier string.
     * @param {Object} query - Dynamic parameter bounds and query qualifiers wrapper context.
     * @param {number|string} [query.limit] - Cap ceiling establishing output page block elements density.
     * @param {string} [query.before] - Cursor indicator ID tracking upper boundaries for history slices.
     * @param {number|string} [query.page] - Page sequence index multiplier required under traditional lookups.
     * @throws {AppError} 403 - If session token credentials fail relationship partnership checks.
     * @throws {AppError} 404 - If structural database components return an uninitialized session record.
     * @returns {Promise<Object>} Formatted message history layout DTO configuration variables.
     */
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
            return toMessageListDTO({ messages: messages.toReversed(), pagination: { mode: "cursor", hasMore: messages.length === limit } });
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

    /**
     * Quantifies outstanding inbound items sent by the opposite conversation member.
     * * @async
     * @function getUnreadCount
     * @param {string} connectRequestId - Primary channel selector check index parameter.
     * @param {string} userId - Inbound user token identification index string reference.
     * @returns {Promise<Object>} Formatted unread dashboard notification metrics DTO.
     */
    const getUnreadCount = async (connectRequestId, userId) => {
        const count = await messageRepo.countUnreadMessages(connectRequestId, userId);
        return toUnreadCountDTO(count);
    };

    return { getMessages, getUnreadCount };
};

module.exports = createMessageService;