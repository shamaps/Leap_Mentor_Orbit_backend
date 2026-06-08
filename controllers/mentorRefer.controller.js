// controllers/mentorRefer.controller.js
const mentorReferService = require("../services/mentorRefer.service");

const { logger } = require("@sentry/node");
/**
 * GET /api/connect-requests/:id/similar-mentors
 */
const getSimilarMentors = async (req, res) => {
  try {
    const data = await mentorReferService.getSimilarMentors(req.params.id, req.user._id);
    logger.info("getSimilarMentors completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("❌ Similar mentors error:", err.message);
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { getSimilarMentors };