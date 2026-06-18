// backend/controllers/feedback.controller.js
const { handleError } = require("../utils/appError");
const { ok, created } = require("../utils/response");
const createFeedbackController = (feedbackService, { logger }) => {
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
    return created(res, feedback);
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
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "feedback.getFeedback");
  }
};

  return { submitFeedback, getFeedback };
};
module.exports = createFeedbackController;