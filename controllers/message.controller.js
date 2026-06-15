// controllers/message.controller.js
const messageService = require("../services/message.service");
const logger = require("../utils/logger");
const AppError = require("../utils/AppError");
const { handleError } = require("../utils/AppError");
// ─────────────────────────────────────────────────────────────
// GET /api/messages/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getMessages = async (req, res) => {
  try {
    const data = await messageService.getMessages(
      req.params.connectRequestId,
      req.user._id.toString(),
      req.query
    );
    logger.info("getMessages completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in message.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "message.getMessages");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/messages/:connectRequestId/unread-count
// ─────────────────────────────────────────────────────────────
const getUnreadCount = async (req, res) => {
  try {
    const data = await messageService.getUnreadCount(
      req.params.connectRequestId,
      req.user._id.toString()
    );
    logger.info("getUnreadCount completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in message.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "message.getUnreadCount");
  }
};

module.exports = { getMessages, getUnreadCount };