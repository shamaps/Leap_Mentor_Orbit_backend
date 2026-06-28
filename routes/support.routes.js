const express = require("express");
const router = express.Router();
const { supportController } = require("../config/container");
const { createMessage, getMessages, resolveMessage } = supportController;
const { adminAuthenticate } = require("../middleware/adminAuth");
const { supportLimiter } = require("../middleware/rateLimiter");
const validate = require("../middleware/validate");
const { createSupportMessageSchema } = require("../validators/support.validator");

/**
 * @openapi
 * /support/messages:
 *   post:
 *     tags: [Support]
 *     summary: Submit a help center message
 *     description: Public — submitted from the HelpCenter form, no auth required. Rate-limited via supportLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, subject, message]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 200
 *               message:
 *                 type: string
 *                 minLength: 10
 *                 maxLength: 2000
 *               role:
 *                 type: string
 *                 enum: [mentor, mentee, user]
 *     responses:
 *       201:
 *         description: Message submitted.
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
 */
router.post("/messages", supportLimiter, validate(createSupportMessageSchema), createMessage);   // public — from HelpCenter form

/**
 * @openapi
 * /support/messages:
 *   get:
 *     tags: [Support]
 *     summary: List help center messages (admin)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of support messages.
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
router.get("/messages", adminAuthenticate, getMessages);                      // admin only

/**
 * @openapi
 * /support/messages/{id}/resolve:
 *   patch:
 *     tags: [Support]
 *     summary: Mark a help center message as resolved (admin)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Message marked resolved.
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
router.patch("/messages/:id/resolve", adminAuthenticate, resolveMessage);     // admin only

module.exports = router;
