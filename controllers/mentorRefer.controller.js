// controllers/mentorRefer.controller.js
const mentorReferService = require("../services/mentorRefer.service");
const { handleError } = require("../utils/appError");
const logger = require("../utils/logger");
const { ok } = require("../utils/response");

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

module.exports = { getSimilarMentors };