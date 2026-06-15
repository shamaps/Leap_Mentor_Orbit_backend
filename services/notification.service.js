// services/notification.service.js
const notificationRepo = require("../repositories/notification.repository");

const logger = require("../utils/logger");
// GET /api/notifications
const getNotifications = async (userId) => {
    // Debug logs preserved from original
    logger.info("🔍 Getting notifications for user ID:", userId.toString());
    const all = await notificationRepo.findAllNotifications();
    logger.info("🔍 Total notifications in DB:", all.length);
    logger.info("🔍 All recipient IDs in DB:", all.map((n) => n.recipient.toString()));

    const notifications = await notificationRepo.findNotificationsByUser(userId);
    logger.info("🔍 Matched notifications for this user:", notifications.length);

    return { notifications };
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