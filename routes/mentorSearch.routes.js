// routes/mentorSearch.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const {
searchMentors,
autocompleteMentors,
} = require("../controllers/mentorSearch.controller");
// Main search — authenticated mentees only
router.get("/search", authenticate, searchMentors);
// Autocomplete — authenticated, lightweight
router.get("/autocomplete", authenticate, autocompleteMentors);
module.exports = router;