// services/notification.service.js
const { toNotificationList } = require("../utils/mappers/notification.mapper");
const createNotificationService = (notificationRepo, { logger }) => {
    // GET /api/notifications
    const getNotifications = async (userId) => {
        logger.debug("getNotifications called", { userId: userId.toString() });

        const notifications = await notificationRepo.findNotificationsByUser(userId);
        logger.debug("Notifications fetched", { count: notifications.length });

        return { notifications: toNotificationList(notifications) };
    };

    // PATCH /api/notifications/mark-all-read
    const markAllRead = async (userId) => {
        await notificationRepo.markAllReadByUser(userId);
        return { message: "All notifications marked as read" };
    };

    // PATCH /api/notifications/:id/read
    const markOneRead = async (notificationId, userId) => {
        await notificationRepo.markOneReadByUser(notificationId, userId);
        return { message: "Notification marked as read" };
    };

    // DELETE /api/notifications/:id
    const deleteNotification = async (notificationId, userId) => {
        await notificationRepo.deleteOneByUser(notificationId, userId);
        return { message: "Notification deleted" };
    };

    // DELETE /api/notifications/clear-all
    const clearAll = async (userId) => {
        await notificationRepo.deleteAllByUser(userId);
        return { message: "All notifications cleared" };
    };

    return { getNotifications, markAllRead, markOneRead, deleteNotification, clearAll };
};
module.exports = createNotificationService;