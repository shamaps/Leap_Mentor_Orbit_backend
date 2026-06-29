// backend/routes/upload.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { upload, uploadImage } = require("../middleware/upload.middleware");
const { uploadController } = require("../config/container");
const {
  uploadProfilePicture, uploadVerificationDocuments,
} = uploadController;
const { uploadLimiter } = require("../middleware/rateLimiter");

/**
 * @openapi
 * /upload/profile-picture:
 *   post:
 *     tags: [Upload]
 *     summary: Upload a profile picture
 *     description: Rate-limited via uploadLimiter.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [profilePicture]
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture uploaded.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         url:
 *                           type: string
 *                           format: uri
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /api/upload/profile-picture
router.post(
  "/profile-picture",
  authenticate,
  uploadImage.single("profilePicture"),
  uploadLimiter,
  uploadProfilePicture
);

/**
 * @openapi
 * /upload/verification-documents:
 *   post:
 *     tags: [Upload]
 *     summary: Upload mentor verification documents
 *     description: Mentor role only. Rate-limited via uploadLimiter. Accepts a resume (1 file) and work experience docs (up to 3 files).
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               resume:
 *                 type: string
 *                 format: binary
 *               workExperienceDocs:
 *                 type: array
 *                 maxItems: 3
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Documents uploaded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not a mentor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /api/upload/verification-documents — mentor only
router.post(
  "/verification-documents",
  authenticate,
  requireRole("mentor"),
  upload.fields([
    { name: "resume", maxCount: 1 },
    { name: "workExperienceDocs", maxCount: 3 },
  ]),
  uploadLimiter,
  uploadVerificationDocuments
);

module.exports = router;
