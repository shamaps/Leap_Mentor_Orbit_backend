// controllers/notification.controller.js
const { ok, noContent } = require("../utils/response");
const AppError = require("../utils/appError");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} NotificationService
 * @property {(userId: any) => Promise<Object>} getNotifications - Core service extracting recipient notifications lists.
 * @property {(userId: any) => Promise<{message: string}>} markAllRead - Core service transforming bulk unread status.
 * @property {(notificationId: string, userId: any) => Promise<{message: string}>} markOneRead - Core service flagging singular entries read.
 * @property {(notificationId: string, userId: any) => Promise<{message: string}>} deleteNotification - Core service removing individual records.
 * @property {(userId: any) => Promise<{message: string}>} clearAll - Core service purging complete recipient indices.
 */

/**
 * Factory implementing presenting layer endpoint controllers bound to inbound network routers.
 * * @param {NotificationService} notificationService - Core underlying business logic orchestration worker instance.
 * @param {{ logger: Logger }} dependencies - Metric tracking and application performance logging analytics capture tool.
 * @returns {Object} Grouped Express endpoints callbacks map configuration.
 */
const createNotificationController = (notificationService, { logger }) => {

  /**
   * Express Route Handler parsing session token vectors to emit user notifications lists.
   * * @async
   * @function getNotifications
   * @param {import('express').Request & { user: { _id: any } }} req - Input message frame context holding validation data indices.
   * @param {import('express').Response} res - Standard connection output response transport pipe layer adapter.
   */
  const getNotifications = async (req, res) => {
    try {
      const data = await notificationService.getNotifications(req.user._id);
      logger.info("getNotifications completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "notification.getNotifications");
    }
  };

  /**
   * Express Route Handler directing inputs to modify bulk status parameters across unread items.
   * * @async
   * @function markAllRead
   * @param {import('express').Request & { user: { _id: any } }} req - Inbound transaction context request container holding token criteria.
   * @param {import('express').Response} res - Standard data output channel execution returning connector transport.
   */
  const markAllRead = async (req, res) => {
    try {
      const data = await notificationService.markAllRead(req.user._id);
      logger.info("markAllRead completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "notification.markAllRead");
    }
  };

  /**
   * Express Route Handler parsing singular path parameters keys to mark custom notifications viewed.
   * * @async
   * @function markOneRead
   * @param {import('express').Request & { user: { _id: any }, params: { id: string } }} req - Express request envelope containing path descriptors query parameters.
   * @param {import('express').Response} res - Structural payload interface output return connector adapter pipeline.
   */
  const markOneRead = async (req, res) => {
    try {
      const data = await notificationService.markOneRead(req.params.id, req.user._id);
      logger.info("markOneRead completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "notification.markOneRead");
    }
  };

  /**
   * Express Route Handler initiating immediate removal workflows over individual target notifications.
   * * @async
   * @function deleteNotification
   * @param {import('express').Request & { user: { _id: any }, params: { id: string } }} req - Input request frame context holding parameter tracking indicators path.
   * @param {import('express').Response} res - Direct termination method transport interface closure adapter pipeline.
   */
  const deleteNotification = async (req, res) => {
    try {
      await notificationService.deleteNotification(req.params.id, req.user._id);
      logger.info("deleteNotification completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "notification.deleteNotification");
    }
  };

  /**
   * Express Route Handler purging the complete historical records block belonging to the authenticated actor user.
   * * @async
   * @function clearAll
   * @param {import('express').Request & { user: { _id: any } }} req - Inbound request framework parameters mapping dynamic variables.
   * @param {import('express').Response} res - Direct completion response adapter pipeline closure socket pipeline.
   */
  const clearAll = async (req, res) => {
    try {
      await notificationService.clearAll(req.user._id);
      logger.info("clearAll completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "notification.clearAll");
    }
  };

  return { getNotifications, markAllRead, markOneRead, deleteNotification, clearAll };
};

module.exports = createNotificationController;