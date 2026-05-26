// controllers/mentorRefer.controller.js
const mentorReferService = require("../services/mentorRefer.service");

/**
 * GET /api/connect-requests/:id/similar-mentors
 */
const getSimilarMentors = async (req, res) => {
  try {
    const data = await mentorReferService.getSimilarMentors(req.params.id, req.user._id);
    return res.json({ success: true, ...data });
  } catch (err) {
    console.error("❌ Similar mentors error:", err.message);
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

module.exports = { getSimilarMentors };