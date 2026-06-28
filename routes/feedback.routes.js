// backend/routes/feedback.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { feedbackController } = require("../config/container");
const { submitFeedback, getFeedback } = feedbackController;
const validate = require("../middleware/validate");
const { submitFeedbackSchema } = require("../validators/feedback.validator");

/**
 * @openapi
 * /feedback:
 *   post:
 *     tags: [Feedback]
 *     summary: Submit post-session feedback
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [connectRequestId, rating]
 *             properties:
 *               connectRequestId:
 *                 type: string
 *                 example: "665f1c2e4b1a2c001f8e9a44"
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 maxLength: 1000
 *               slotIndex:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       201:
 *         description: Feedback submitted.
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
 *         description: Not a party to this connect request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// POST /api/feedback                        — only mentees submit feedback on their mentor
router.post("/", authenticate, requireRole("mentor", "mentee"), validate(submitFeedbackSchema), submitFeedback);

/**
 * @openapi
 * /feedback/{connectRequestId}:
 *   get:
 *     tags: [Feedback]
 *     summary: Get feedback for a session
 *     description: Both mentor and mentee can read session feedback.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: connectRequestId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Feedback for the session.
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
 *         description: Not a party to this connect request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET  /api/feedback/:connectRequestId      — both parties can read session feedback
router.get("/:connectRequestId", authenticate, requireRole("mentor", "mentee"), getFeedback);

module.exports = router;
