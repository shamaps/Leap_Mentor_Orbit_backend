// routes/adminVerification.routes.js
const express = require("express");
const { adminVerificationController } = require("../config/container");
const {
  getAllMentorVerifications, getMentorVerificationById, verifyMentor, revokeMentorVerification,
} = adminVerificationController;
const { adminAuthenticate } = require("../middleware/adminAuth.js");

const router = express.Router();

// All routes protected by admin auth
router.use(adminAuthenticate);

// GET  /api/admin/mentor-verifications         → list all
/**
 * @openapi
 * /admin/mentor-verifications/:
 *   get:
 *     tags: [AdminVerifications]
 *     summary: List all mentor verification requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of mentor verification requests.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/", getAllMentorVerifications);

/**
 * @openapi
 * /admin/mentor-verifications/{mentorProfileId}:
 *   get:
 *     tags: [AdminVerifications]
 *     summary: Get a single mentor's verification detail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: mentorProfileId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mentor verification detail (includes uploaded resume/work experience docs).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Mentor profile not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:mentorProfileId", getMentorVerificationById);

/**
 * @openapi
 * /admin/mentor-verifications/{mentorProfileId}/verify:
 *   patch:
 *     tags: [AdminVerifications]
 *     summary: Mark a mentor as verified
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: mentorProfileId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Mentor verified.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/:mentorProfileId/verify", verifyMentor);

/**
 * @openapi
 * /admin/mentor-verifications/{mentorProfileId}/revoke:
 *   patch:
 *     tags: [AdminVerifications]
 *     summary: Revoke a mentor's verification
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: mentorProfileId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Verification revoked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/:mentorProfileId/revoke", revokeMentorVerification);

module.exports = router;