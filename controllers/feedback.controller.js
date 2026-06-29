// backend/controllers/feedback.controller.js
const { handleError } = require("../utils/appError");
const { ok, created } = require("../utils/response");

/**
 * @typedef {Object} FeedbackService
 * @property {(payload: Object) => Promise<Object>} submitFeedback - Service logic checking and saving feedback logs.
 * @property {(query: Object) => Promise<Object>} getFeedback - Service logic mapping visibility items.
 */

/**
 * Factory implementing handling middleware bound to inbound HTTP presentation routes for parsing feedback.
 * * @param {FeedbackService} feedbackService - Configured service instance orchestrating operational steps.
 * @param {{ logger: Object }} dependencies - System instrumentation module capturing analytics tracking metrics.
 * @returns {Object} Grouped Express presentation layer callback functions map configuration.
 */
const createFeedbackController = (feedbackService, { logger }) => {

  /**
   * Express Route Handler receiving dynamic payload values to write participant feedback log parameters.
   * * @async
   * @function submitFeedback
   * @param {import('express').Request & { user: { _id: any } }} req - Input request frame context holding parameter metrics body.
   * @param {import('express').Response} res - Standard outbound communication connection wrapper pipeline.
   */
  const submitFeedback = async (req, res) => {
    try {
      const feedback = await feedbackService.submitFeedback({
        connectRequestId: req.body.connectRequestId,
        rating: req.body.rating,
        comment: req.body.comment,
        slotIndex: req.body.slotIndex !== undefined && req.body.slotIndex !== null ? Number.parseInt(req.body.slotIndex, 10) : undefined,
        userId: req.user._id,
      });
      logger.info("submitFeedback completed successfully");
      return created(res, feedback);
    } catch (err) {
      return handleError(res, err, "feedback.submitFeedback");
    }
  };

  /**
   * Express Route Handler parsing primary target selectors to map contextual feedback items.
   * * @async
   * @function getFeedback
   * @param {import('express').Request & { user: { _id: any } }} req - Route context request envelope containing path variables.
   * @param {import('express').Response} res - Dispatched transport result pipe layer interface.
   */
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