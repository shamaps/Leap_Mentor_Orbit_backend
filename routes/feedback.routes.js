// backend/routes/feedback.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { feedbackController } = require("../config/container");
const { submitFeedback, getFeedback } = feedbackController;
// POST /api/feedback                        — only mentees submit feedback on their mentor
router.post("/", authenticate, requireRole("mentor", "mentee"), submitFeedback);

// GET  /api/feedback/:connectRequestId      — both parties can read session feedback
router.get("/:connectRequestId", authenticate, requireRole("mentor", "mentee"), getFeedback);

module.exports = router;