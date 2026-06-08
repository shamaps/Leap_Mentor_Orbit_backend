// repositories/notification.repository.js
const Notification = require("../models/Notification");

const findAllNotifications = () =>
    Notification.find({});

const findNotificationsByUser = (userId) =>
    Notification.find({ recipient: userId }).sort({ createdAt: -1 }).limit(50);

const markAllReadByUser = (userId) =>
    Notification.updateMany({ recipient: userId, read: false }, { read: true });

const markOneReadByUser = (notificationId, userId) =>
    Notification.findOneAndUpdate(
        { _id: notificationId, recipient: userId },
        { read: true }
    );

const deleteOneByUser = (notificationId, userId) =>
    Notification.findOneAndDelete({ _id: notificationId, recipient: userId });

const deleteAllByUser = (userId) =>
    Notification.deleteMany({ recipient: userId });

module.exports = {
    findAllNotifications,
    findNotificationsByUser,
    markAllReadByUser,
    markOneReadByUser,
    deleteOneByUser,
    deleteAllByUser,
};