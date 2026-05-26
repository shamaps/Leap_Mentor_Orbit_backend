// controllers/message.controller.js
const messageService = require("../services/message.service");

const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

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
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
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
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = { getMessages, getUnreadCount };