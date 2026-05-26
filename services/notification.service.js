// services/notification.service.js
const notificationRepo = require("../repositories/notification.repository");

// GET /api/notifications
const getNotifications = async (userId) => {
    // Debug logs preserved from original
    console.log("🔍 Getting notifications for user ID:", userId.toString());
    const all = await notificationRepo.findAllNotifications();
    console.log("🔍 Total notifications in DB:", all.length);
    console.log("🔍 All recipient IDs in DB:", all.map((n) => n.recipient.toString()));

    const notifications = await notificationRepo.findNotificationsByUser(userId);
    console.log("🔍 Matched notifications for this user:", notifications.length);

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