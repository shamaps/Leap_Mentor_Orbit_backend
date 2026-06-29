// controllers/message.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} MessageService
 * @property {(connectRequestId: string, userId: string, queryParams: Object) => Promise<Object>} getMessages - Services logic evaluating parameters to return conversation segments.
 * @property {(connectRequestId: string, userId: string) => Promise<Object>} getUnreadCount - Services logic compiling outstanding notification counters.
 */

/**
 * Factory assembling presentation entry controllers handling dynamic messaging endpoints for HTTP tracking.
 * * @param {MessageService} messageService - Configured service instance orchestrating operational logic.
 * @param {{ logger: Logger }} dependencies - Performance trace logger diagnostics utility parameters wrapper.
 * @returns {Object} Grouped controller routes callback actions container mapping blueprint.
 */
const createMessageController = (messageService, { logger }) => {
  // GET /api/messages/:connectRequestId

  /**
   * Express Route Handler parsing query properties and token pointers to return structured dialogue segments.
   * * @async
   * @function getMessages
   * @param {import('express').Request & { user: { _id: Object } }} req - Input message frame request envelope parsing dynamic paths.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket channel.
   */
  const getMessages = async (req, res) => {
    try {
      const data = await messageService.getMessages(
        req.params.connectRequestId,
        req.user._id.toString(),
        req.query
      );
      logger.info("getMessages completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "message.getMessages");
    }
  };

  // GET /api/messages/:connectRequestId/unread-count

  /**
   * Express Route Handler rendering outstanding notification volume metrics matching communication tunnels.
   * * @async
   * @function getUnreadCount
   * @param {import('express').Request & { user: { _id: Object } }} req - Route context parameter request object holding indices.
   * @param {import('express').Response} res - Dispatched output data interface component transport adapter pipeline socket.
   */
  const getUnreadCount = async (req, res) => {
    try {
      const data = await messageService.getUnreadCount(
        req.params.connectRequestId,
        req.user._id.toString()
      );
      logger.info("getUnreadCount completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "message.getUnreadCount");
    }
  };

  return { getMessages, getUnreadCount };
};

module.exports = createMessageController;