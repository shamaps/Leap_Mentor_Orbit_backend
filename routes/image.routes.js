// routes/image.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const { cloudinary } = require("../config/cloudinary");

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
router.get("/profile/:userId", authenticate, (req, res) => {
    const { userId } = req.params;

    const w = Math.min(Math.max(Number.parseInt(req.query.w) || 80, 1), 400);
    const h = Math.min(Math.max(Number.parseInt(req.query.h) || 80, 1), 400);

    const publicId = `leapmentor/profiles/user-${userId}`;

    const url = cloudinary.url(publicId, {
        resource_type: "image",
        type: "upload",
        transformation: [
            { width: w, height: h, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
        ],
    });

    return res.json({ success: true, url, width: w, height: h });
});

module.exports = router;