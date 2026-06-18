// routes/mentorSearch.routes.js
const express = require("express");
const router = express.Router();
const { mentorSearchController } = require("../config/container");
const { searchMentors, autocompleteMentors } = mentorSearchController;
const { authenticate, requireRole } = require("../middleware/authenticate");

// GET /api/mentors/search
// Only logged-in mentees can search for mentors
router.get("/search", authenticate,searchMentors);

module.exports = router;