// backend/routes/feedback.routes.js
const express  = require("express");
const router   = express.Router();
const { authenticate }                  = require("../middleware/authenticate");
const { feedbackController } = require("../config/container");
const { submitFeedback, getFeedback } = feedbackController;
// POST /api/feedback                        — submit feedback for a completed session
router.post("/",                      authenticate, submitFeedback);

// GET  /api/feedback/:connectRequestId      — get my + their feedback for a session
router.get("/:connectRequestId",      authenticate, getFeedback);

module.exports = router;