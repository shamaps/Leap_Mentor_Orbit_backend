// controllers/notification.controller.js
const notificationService = require("../services/notification.service");

const handleError = (res, message) =>
  res.status(500).json({ message });

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const data = await notificationService.getNotifications(req.user._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, "Failed to fetch notifications");
  }
};

// PATCH /api/notifications/mark-all-read
const markAllRead = async (req, res) => {
  try {
    const data = await notificationService.markAllRead(req.user._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, "Failed to mark notifications as read");
  }
};

// PATCH /api/notifications/:id/read
const markOneRead = async (req, res) => {
  try {
    const data = await notificationService.markOneRead(req.params.id, req.user._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, "Failed to mark notification as read");
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    const data = await notificationService.deleteNotification(req.params.id, req.user._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, "Failed to delete notification");
  }
};

// DELETE /api/notifications/clear-all
const clearAll = async (req, res) => {
  try {
    const data = await notificationService.clearAll(req.user._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, "Failed to clear notifications");
  }
};

module.exports = {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
  clearAll,
};