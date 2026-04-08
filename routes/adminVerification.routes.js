// routes/adminVerification.routes.js
const express = require("express");
const {
  getAllMentorVerifications,
  getMentorVerificationById,
  verifyMentor,
  revokeMentorVerification,
} = require("../controllers/adminVerification.controller.js");
const { adminAuthenticate } = require("../middleware/adminAuth.js");

const router = express.Router();

// All routes protected by admin auth
router.use(adminAuthenticate);

// GET  /api/admin/mentor-verifications         → list all
router.get("/", getAllMentorVerifications);

// GET  /api/admin/mentor-verifications/:id     → single mentor detail
router.get("/:mentorProfileId", getMentorVerificationById);

// PATCH /api/admin/mentor-verifications/:id/verify  → mark verified
router.patch("/:mentorProfileId/verify", verifyMentor);

// PATCH /api/admin/mentor-verifications/:id/revoke  → revoke (optional)
router.patch("/:mentorProfileId/revoke", revokeMentorVerification);

module.exports = router;