// backend/controllers/feedback.controller.js
const AppError = require("../utils/AppError");
const feedbackService = require("../services/feedback.service");

const { logger } = require("@sentry/node");
// ── Centralised error handler ─────────────────────────────────
const handleError = (res, err, label) => {
  if (err instanceof AppError)
    return res.status(err.status).json({ message: err.message });
  if (err.code === 11000)
    return res.status(409).json({ message: "You have already submitted feedback for this session" });
  logger.error(`❌ ${label} error:`, err.message);
  return res.status(500).json({ message: err.message });
};

// ─────────────────────────────────────────────────────────────
// POST /api/feedback
// ─────────────────────────────────────────────────────────────
const submitFeedback = async (req, res) => {
  try {
    const feedback = await feedbackService.submitFeedback({
      connectRequestId: req.body.connectRequestId,
      rating: req.body.rating,
      comment: req.body.comment,
      slotIndex: req.body.slotIndex,
      userId: req.user._id,
    });
    logger.info("submitFeedback completed successfully");
    return res.status(201).json({ success: true, feedback });
  } catch (err) {
    logger.error("Unhandled error in feedback.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "submitFeedback");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/feedback/:connectRequestId
// ─────────────────────────────────────────────────────────────
const getFeedback = async (req, res) => {
  try {
    const data = await feedbackService.getFeedback({
      connectRequestId: req.params.connectRequestId,
      userId: req.user._id,
    });
    logger.info("getFeedback completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in feedback.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getFeedback");
  }
};

module.exports = { submitFeedback, getFeedback };