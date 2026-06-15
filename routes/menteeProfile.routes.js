// routes/menteeProfile.routes.js
const express = require("express");
const { authenticate, requireRole } = require("../middleware/authenticate");
const {
  createProfile,
  getMyProfile,
  updateProfile,
  getPublicProfile,
} = require("../controllers/menteeProfile.controller");

const router = express.Router();

// ✅ POST /api/mentee-profile — create profile (onboarding)
router.post(
  "/",
  authenticate,
  requireRole("mentee"),
  createProfile
);

// ✅ GET /api/mentee-profile/me — get own profile
router.get(
  "/me",
  authenticate,
  requireRole("mentee"),
  getMyProfile
);

// ✅ PATCH /api/mentee-profile/me — update own profile
router.patch(
  "/me",
  authenticate,
  requireRole("mentee"),
  updateProfile
);

// ✅ GET /api/mentee-profile/:id — get any mentee's public profile (no auth needed)
router.get("/:id", getPublicProfile);

module.exports = router;