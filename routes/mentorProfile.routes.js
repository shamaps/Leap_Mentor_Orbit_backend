// routes/mentorProfile.routes.js


// POST   /api/mentor-profile        ← create profile (mentor only)
// GET    /api/mentor-profile/me     ← get own profile (mentor only)
// PUT    /api/mentor-profile/me     ← update profile (mentor only)
// GET    /api/mentor-profile/:id    ← public profile (no auth)
const express = require("express");
const { authenticate, requireRole } = require("../middleware/authenticate");
const { mentorProfileController } = require("../config/container");
const {
  createProfile, getMyProfile, updateProfile, getPublicProfile,
} = mentorProfileController;

const router = express.Router();

// ✅ POST /api/mentor-profile — create profile (onboarding)
router.post(
  "/",
  authenticate,
  requireRole("mentor"),
  createProfile
);

// ✅ GET /api/mentor-profile/me — get own profile
router.get(
  "/me",
  authenticate,
  requireRole("mentor"),
  getMyProfile
);

// ✅ PATCH /api/mentor-profile/me — update own profile
router.patch(
  "/me",
  authenticate,
  requireRole("mentor"),
  updateProfile
);

// ✅ GET /api/mentor-profile/:id — get any mentor's public profile (no auth needed)
router.get("/:id", getPublicProfile);

module.exports = router;


