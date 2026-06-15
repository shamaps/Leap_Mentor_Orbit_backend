// controllers/notification.controller.js
const notificationService = require("../services/notification.service");

const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const { handleError } = require("../utils/AppError");

// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const data = await notificationService.getNotifications(req.user._id);
    logger.info("getNotifications completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in notification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "notification.getNotifications");
  }
};

// PATCH /api/notifications/mark-all-read
const markAllRead = async (req, res) => {
  try {
    const data = await notificationService.markAllRead(req.user._id);
    logger.info("markAllRead completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in notification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "notification.markAllRead");
  }
};

// PATCH /api/notifications/:id/read
const markOneRead = async (req, res) => {
  try {
    const data = await notificationService.markOneRead(req.params.id, req.user._id);
    logger.info("markOneRead completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in notification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "notification.markOneRead");
  }
};

// DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    await notificationService.deleteNotification(req.params.id, req.user._id);
    logger.info("deleteNotification completed successfully");
    return res.status(204).send();
  } catch (err) {
    logger.error("Unhandled error in notification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "notification.deleteNotification");
  }
};

// DELETE /api/notifications/clear-all
const clearAll = async (req, res) => {
  try {
    await notificationService.clearAll(req.user._id);
    logger.info("clearAll completed successfully");
    return res.status(204).send();
  } catch (err) {
    logger.error("Unhandled error in notification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "notification.clearAll");
  }
};

module.exports = {
  getNotifications,
  markAllRead,
  markOneRead,
  deleteNotification,
  clearAll,
};