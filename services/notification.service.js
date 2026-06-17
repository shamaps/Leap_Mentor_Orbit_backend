// services/notification.service.js
const notificationRepo = require("../repositories/notification.repository");
const { toNotificationList } = require("../utils/mappers/notification.mapper");
const logger = require("../utils/logger");
// GET /api/notifications
const getNotifications = async (userId) => {
    // Debug logs preserved from original
    logger.debug("Getting notifications for user ID:", userId.toString());
    const all = await notificationRepo.findAllNotifications();
    logger.debug("Total notifications in DB:", all.length);
    logger.debug("All recipient IDs in DB:", all.map((n) => n.recipient.toString()));

    const notifications = await notificationRepo.findNotificationsByUser(userId);
    logger.debug("Matched notifications for this user:", notifications.length);

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

module.exports = {
    getNotifications,
    markAllRead,
    markOneRead,
    deleteNotification,
    clearAll,
};