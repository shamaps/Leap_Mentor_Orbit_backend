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
const validate = require("../middleware/validate");
const { profileSchema } = require("../validators/mentorProfile.validator");

const router = express.Router();

/**
 * @openapi
 * /mentor-profile:
 *   post:
 *     tags: [MentorProfile]
 *     summary: Create mentor profile (onboarding)
 *     description: Mentor role only.
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
 *                 example: "Senior Engineer"
 *               industry:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Software"
 *               company:
 *                 type: string
 *                 maxLength: 100
 *                 example: "Acme Corp"
 *               bio:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "10 years building distributed systems."
 *               yearsOfExperience:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 60
 *                 example: 10
 *               hourlyRate:
 *                 type: number
 *                 minimum: 0
 *                 example: 25
 *               skills:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Node.js", "System Design"]
 *               communicationPreferences:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [Chat, Email, "Video Call", "Phone Call", "In-Person"]
 *                 example: ["Video Call", "Chat"]
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["English"]
 *               linkedInUrl:
 *                 type: string
 *                 format: uri
 *               portfolioUrl:
 *                 type: string
 *                 format: uri
 *               profilePicture:
 *                 type: string
 *                 maxLength: 2048
 *               phoneNumber:
 *                 type: string
 *                 maxLength: 20
 *                 example: "+919876543210"
 *     responses:
 *       201:
 *         description: Mentor profile created.
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
 *         description: Logged-in user does not have the mentor role.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, requireRole("mentor"), validate(profileSchema), createProfile);

/**
 * @openapi
 * /mentor-profile/me:
 *   get:
 *     tags: [MentorProfile]
 *     summary: Get own mentor profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Own mentor profile.
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
  requireRole("mentor"),
  getMyProfile
);

/**
 * @openapi
 * /mentor-profile/me:
 *   patch:
 *     tags: [MentorProfile]
 *     summary: Update own mentor profile
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
 *               hourlyRate:
 *                 type: number
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
 *         description: Not a mentor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/me", authenticate, requireRole("mentor"), validate(profileSchema), updateProfile);

/**
 * @openapi
 * /mentor-profile/{id}:
 *   get:
 *     tags: [MentorProfile]
 *     summary: Get a mentor's public profile
 *     description: No authentication required.
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Public mentor profile.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       404:
 *         description: Mentor profile not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/:id", getPublicProfile);

module.exports = router;
