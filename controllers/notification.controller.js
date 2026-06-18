// controllers/notification.controller.js
const { ok,noContent } = require("../utils/response");
const AppError = require("../utils/appError");
const { handleError } = require("../utils/appError");
const createNotificationController = (notificationService, { logger }) => {
// GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const data = await notificationService.getNotifications(req.user._id);
    logger.info("getNotifications completed successfully");
    return ok(res, data);
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
    return ok(res, data);
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
    return ok(res, data);
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
    return noContent(res);
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
    return noContent(res);
  } catch (err) {
    logger.error("Unhandled error in notification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "notification.clearAll");
  }
};

  return { getNotifications, markAllRead, markOneRead, deleteNotification, clearAll };
};
module.exports = createNotificationController;