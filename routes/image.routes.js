// routes/image.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const { imageController } = require("../config/container");

const { getProfileImage } = imageController;

/**
 * GET /api/v1/images/profile/:userId?w=56&h=56
 *
 * Returns a Cloudinary URL resized to the exact dimensions requested.
 * Cloudinary serves the pre-generated eager variant if available,
 * otherwise generates and caches it on the fly.
 *
 * Query params:
 *   w  — desired width  in pixels (default: 80, max: 400)
 *   h  — desired height in pixels (default: 80, max: 400)
 */
router.get("/profile/:userId", authenticate, getProfileImage);

module.exports = router;