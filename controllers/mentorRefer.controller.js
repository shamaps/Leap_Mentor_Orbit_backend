// controllers/mentorRefer.controller.js
const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");
const createMentorReferController = (mentorReferService, { logger }) => {
 //GET /api/connect-requests/:id/similar-mentors

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