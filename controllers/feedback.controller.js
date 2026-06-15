// backend/controllers/feedback.controller.js
const { handleError } = require("../utils/AppError");
const feedbackService = require("../services/feedback.service");
const logger = require("../utils/logger");

// POST /api/feedback
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
    return handleError(res, err, "feedback.submitFeedback");
  }
};

// GET /api/feedback/:connectRequestId
const getFeedback = async (req, res) => {
  try {
    const data = await feedbackService.getFeedback({
      connectRequestId: req.params.connectRequestId,
      userId: req.user._id,
    });
    logger.info("getFeedback completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err, "feedback.getFeedback");
  }
};

module.exports = { submitFeedback, getFeedback };