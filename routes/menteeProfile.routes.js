// routes/menteeProfile.routes.js
const express = require("express");
const { authenticate, requireRole } = require("../middleware/authenticate");
const { menteeProfileController } = require("../config/container");
const {
  createProfile, getMyProfile, updateProfile, getPublicProfile,
} = menteeProfileController;
const validate = require("../middleware/validate");
const { profileSchema } = require("../validators/menteeProfile.validator");
const router = express.Router();

/**
 * @openapi
 * /mentee-profile:
 *   post:
 *     tags: [MenteeProfile]
 *     summary: Create mentee profile (onboarding)
 *     description: Mentee role only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentRole:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Product Manager"
 *               industry:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Fintech"
 *               company:
 *                 type: string
 *                 maxLength: 100
 *               bio:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "Looking to grow into engineering leadership."
 *               yearsOfExperience:
 *                 type: string
 *                 example: "3"
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *               interestedFields:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Engineering Management"]
 *               communicationPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [Chat, Email, "Video Call", "Phone Call", "In-Person"]
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *               linkedInUrl:
 *                 type: string
 *                 format: uri
 *               portfolioUrl:
 *                 type: string
 *                 format: uri
 *               profilePicture:
 *                 type: string
 *                 maxLength: 2048
 *     responses:
 *       201:
 *         description: Mentee profile created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Logged-in user does not have the mentee role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, requireRole("mentee"), validate(profileSchema), createProfile);

/**
 * @openapi
 * /mentee-profile/me:
 *   get:
 *     tags: [MenteeProfile]
 *     summary: Get own mentee profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Own mentee profile.
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
 *         description: Not a mentee.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Profile not yet created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get(
  "/me",
  authenticate,
  requireRole("mentee"),
  getMyProfile
);

/**
 * @openapi
 * /mentee-profile/me:
 *   patch:
 *     tags: [MenteeProfile]
 *     summary: Update own mentee profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               currentRole:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not a mentee.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/me", authenticate, requireRole("mentee"), validate(profileSchema), updateProfile);

/**
 * @openapi
 * /mentee-profile/{id}:
 *   get:
 *     tags: [MenteeProfile]
 *     summary: Get a mentee's public profile
 *     description: No authentication required.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public mentee profile.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       404:
 *         description: Mentee profile not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", getPublicProfile);

module.exports = router;
