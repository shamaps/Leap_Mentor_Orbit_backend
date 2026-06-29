// services/notification.service.js
const { toNotificationList } = require("../utils/mappers/notification.mapper");

/**
 * @typedef {Object} NotificationRepository
 * @property {(userId: any) => Promise<Object[]>} findNotificationsByUser - Resolves notifications belonging to the target recipient.
 * @property {(userId: any) => Promise<Object>} markAllReadByUser - Bulk updates unread statuses to read for a user.
 * @property {(notificationId: string, userId: any) => Promise<Object|null>} markOneReadByUser - Flags a unique notification as read.
 * @property {(notificationId: string, userId: any) => Promise<Object|null>} deleteOneByUser - Remotely evicts a specific notification.
 * @property {(userId: any) => Promise<Object>} deleteAllByUser - Purges the complete notification track logs for a recipient.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} debug - Captures runtime parameter details during diagnostic evaluation.
 * @property {(message: string) => void} info - Logs routine service path completions.
 */

/**
 * Factory function constructing the system Notification Service layer.
 * * @param {NotificationRepository} notificationRepo - The repository instance handling database transactions.
 * @param {{ logger: Logger }} dependencies - Application logging trace instrumentation.
 * @returns {Object} Configured object map containing notification reporting and mutation methods.
 */
const createNotificationService = (notificationRepo, { logger }) => {
    // GET /api/notifications
    /**
     * Resolves an authenticated user's profile notifications list.
     * * @async
     * @function getNotifications
     * @param {any} userId - Authenticated user credential token identity index pointer.
     * @returns {Promise<{ notifications: Array }>} Map data transfer object layout containing formatted lists.
     */
    const getNotifications = async (userId) => {
        logger.debug("getNotifications called", { userId: userId.toString() });

        const notifications = await notificationRepo.findNotificationsByUser(userId);
        logger.debug("Notifications fetched", { count: notifications.length });

        return { notifications: toNotificationList(notifications) };
    };

    // PATCH /api/notifications/mark-all-read
    /**
     * Updates all outstanding unviewed entries owned by the caller into a read state.
     * * @async
     * @function markAllRead
     * @param {any} userId - Dynamic target modifier user unique key.
     * @returns {Promise<{ message: string }>} Success response payload confirmation text.
     */
    const markAllRead = async (userId) => {
        await notificationRepo.markAllReadByUser(userId);
        return { message: "All notifications marked as read" };
    };

    // PATCH /api/notifications/:id/read
    /**
     * Transitions a single targeted notification record node to a viewed read status.
     * * @async
     * @function markOneRead
     * @param {string} notificationId - Target primary database unique lookup index key.
     * @param {any} userId - Security authorization context index validating recipient bounds.
     * @returns {Promise<{ message: string }>} Success response payload confirmation metadata text.
     */
    const markOneRead = async (notificationId, userId) => {
        await notificationRepo.markOneReadByUser(notificationId, userId);
        return { message: "Notification marked as read" };
    };

    // DELETE /api/notifications/:id
    /**
     * Discards a specific notification tracking record item physically from databases.
     * * @async
     * @function deleteNotification
     * @param {string} notificationId - Dynamic primary path target selector string parameters.
     * @param {any} userId - Recipient validation matching verification index pointer.
     * @returns {Promise<{ message: string }>} Success response declaration data.
     */
    const deleteNotification = async (notificationId, userId) => {
        await notificationRepo.deleteOneByUser(notificationId, userId);
        return { message: "Notification deleted" };
    };

    // DELETE /api/notifications/clear-all
    /**
     * Purges the complete notification log history records block belonging to the recipient.
     * * @async
     * @function clearAll
     * @param {any} userId - Target lookup primary indicator index locator string checking ownership.
     * @returns {Promise<{ message: string }>} Success execution confirmation tracking counts context.
     */
    const clearAll = async (userId) => {
        await notificationRepo.deleteAllByUser(userId);
        return { message: "All notifications cleared" };
    };

    return { getNotifications, markAllRead, markOneRead, deleteNotification, clearAll };
};

module.exports = createNotificationService;