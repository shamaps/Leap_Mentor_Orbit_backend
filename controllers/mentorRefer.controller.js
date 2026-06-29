// controllers/mentorRefer.controller.js
const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");

/**
 * @typedef {Object} MentorReferService
 * @property {(requestId: string, userId: any) => Promise<Object>} getSimilarMentors - Business handler ranking potential matches based on skill overlaps.
 */

/**
 * Factory assembling presentation controllers to process candidate recommendations for HTTP routing.
 * * @param {MentorReferService} mentorReferService - Core service business logic layer worker instance.
 * @param {{ logger: Logger }} dependencies - Application performance metric capture monitoring tool.
 * @returns {Object} Grouped controller endpoints route callback actions map container.
 */
const createMentorReferController = (mentorReferService, { logger }) => {
  /**
   * GET /api/connect-requests/:id/similar-mentors
   * Express Route handler parsing path keys to emit sorted recommendation metrics dashboards.
   * * @async
   * @function getSimilarMentors
   * @param {import('express').Request} req - Inbound network context frame tracking path and token details.
   * @param {import('express').Response} res - Outbound data response transport pipeline channel socket.
   */
  const getSimilarMentors = async (req, res) => {
    try {
      const data = await mentorReferService.getSimilarMentors(req.params.id, req.user._id);
      logger.info("getSimilarMentors completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "mentorRefer.getSimilarMentors");
    }
  };

  return { getSimilarMentors };
};

module.exports = createMentorReferController;