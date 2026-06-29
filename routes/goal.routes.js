const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const validate = require("../middleware/validate");
const { createGoalSchema, updateGoalSchema, milestoneSchema, updateMilestoneSchema } = require("../validators/goal.validator");
const { goalController } = require("../config/container");
const {
  createGoal, getGoal, updateGoal, addMilestone, updateMilestone, deleteMilestone,
} = goalController;

/**
 * @openapi
 * /goals:
 *   post:
 *     tags: [Goals]
 *     summary: Create a goal for a connect request
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [connectRequestId, title]
 *             properties:
 *               connectRequestId:
 *                 type: string
 *                 example: "665f1c2e4b1a2c001f8e9a44"
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *                 example: "Master system design fundamentals"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       201:
 *         description: Goal created.
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
// Goal routes — goals belong to a connect request, both parties manage them
router.post("/", authenticate, requireRole("mentor", "mentee"), validate(createGoalSchema), createGoal);

/**
 * @openapi
 * /goals/{connectRequestId}:
 *   get:
 *     tags: [Goals]
 *     summary: Get the goal for a connect request
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
 *         description: Goal detail.
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
router.get("/:connectRequestId", authenticate, requireRole("mentor", "mentee"), getGoal);

/**
 * @openapi
 * /goals/{goalId}:
 *   patch:
 *     tags: [Goals]
 *     summary: Update a goal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: goalId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               status:
 *                 type: string
 *                 enum: [active, completed, abandoned]
 *     responses:
 *       200:
 *         description: Goal updated.
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
 *         description: Not a party to this goal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/:goalId", authenticate, requireRole("mentor", "mentee"), updateGoal);

/**
 * @openapi
 * /goals/{goalId}/milestones:
 *   post:
 *     tags: [Goals]
 *     summary: Add a milestone to a goal
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: goalId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 200
 *                 example: "Complete caching module"
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Milestone added.
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
 *         description: Not a party to this goal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Milestone routes
router.post("/:goalId/milestones", authenticate, requireRole("mentor", "mentee"), validate(milestoneSchema), addMilestone);

/**
 * @openapi
 * /goals/milestones/{milestoneId}:
 *   patch:
 *     tags: [Goals]
 *     summary: Update a milestone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: milestoneId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               completed:
 *                 type: boolean
 *               dueDate:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Milestone updated.
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
 *         description: Not a party to this goal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/milestones/:milestoneId", authenticate, requireRole("mentor", "mentee"), validate(updateMilestoneSchema), updateMilestone);

/**
 * @openapi
 * /goals/milestones/{milestoneId}:
 *   delete:
 *     tags: [Goals]
 *     summary: Delete a milestone
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: milestoneId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Milestone deleted.
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
 *         description: Not a party to this goal.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/milestones/:milestoneId", authenticate, requireRole("mentor", "mentee"), deleteMilestone);

module.exports = router;
