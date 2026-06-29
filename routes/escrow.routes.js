// backend/routes/escrow.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const { paySchema, escrowActionSchema } = require("../validators/escrow.validator");
const { authenticate, requireRole } = require("../middleware/authenticate");
const { escrowController } = require("../config/container");
const {
    pay, release, refund, getStatus, getMyWallet, payAdditional, getCommissionRate,
} = escrowController;
// All escrow routes are protected
router.use(authenticate);

/**
 * @openapi
 * /escrow/pay:
 *   post:
 *     tags: [Escrow]
 *     summary: Lock tokens into escrow after a connect request is accepted
 *     description: Mentee role only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [connectRequestId, sessionRate, sessionCount]
 *             properties:
 *               connectRequestId:
 *                 type: string
 *                 example: "665f1c2e4b1a2c001f8e9a44"
 *               sessionRate:
 *                 type: number
 *                 minimum: 1
 *                 example: 25
 *               sessionCount:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *     responses:
 *       200:
 *         description: Tokens locked into escrow.
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
 *       422:
 *         description: Insufficient wallet balance, or escrow already exists for this request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnprocessableResponse'
 */
// POST /api/escrow/pay
// Mentee locks tokens into escrow after request is accepted
router.post("/pay", requireRole("mentee"), validate(paySchema), pay);

/**
 * @openapi
 * /escrow/commission-rate:
 *   get:
 *     tags: [Escrow]
 *     summary: Get the current platform commission rate
 *     description: Both mentor and mentee roles can read this.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current commission rate.
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
 *                         commissionRate:
 *                           type: number
 *                           example: 10
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /api/escrow/commission-rate
// Both roles can read the platform commission rate
router.get("/commission-rate", getCommissionRate);

/**
 * @openapi
 * /escrow/{requestId}:
 *   patch:
 *     tags: [Escrow]
 *     summary: Release or refund escrowed tokens
 *     description: >
 *       action="release": mentee confirms session complete, tokens released to mentor.
 *       action="refund": either party cancels, tokens returned to mentee.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: requestId
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
 *             required: [action]
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [release, refund]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Escrow released or refunded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: action missing/invalid (must be "release" or "refund"), or Joi validation failed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: 'Invalid action. Use "release" or "refund".'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Role not permitted, or not a party to this request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       422:
 *         description: Escrow already released/refunded.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnprocessableResponse'
 */
// PATCH /api/escrow/:requestId
// Mentee confirms session complete { action: "release" } — tokens released to mentor
// Either party cancels { action: "refund" } — tokens returned to mentee
router.patch("/:requestId", requireRole("mentor", "mentee"), validate(escrowActionSchema), (req, res, next) => {
    const { action } = req.body;
    if (action === "release") return release(req, res, next);
    if (action === "refund") return refund(req, res, next);
    return res.status(400).json({ message: 'Invalid action. Use "release" or "refund".' });
});

/**
 * @openapi
 * /escrow/status/{requestId}:
 *   get:
 *     tags: [Escrow]
 *     summary: Get escrow/payment status for a connect request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: requestId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Escrow status.
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
 *         description: Not a party to this request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /api/escrow/status/:requestId
// Get payment + escrow status for a connect request
router.get("/status/:requestId", requireRole("mentor", "mentee"), getStatus);

/**
 * @openapi
 * /escrow/wallet:
 *   get:
 *     tags: [Escrow]
 *     summary: Get the logged-in user's wallet balance
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wallet balance.
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
 *                         balance:
 *                           type: number
 *                           example: 120
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Role not permitted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /api/escrow/wallet
// Get logged in user's wallet balance
router.get("/wallet", requireRole("mentor", "mentee"), getMyWallet);

/**
 * @openapi
 * /escrow/pay-additional:
 *   post:
 *     tags: [Escrow]
 *     summary: Lock tokens for a single additional session slot
 *     description: Mentee role only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Additional slot paid for.
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
 *       422:
 *         description: Insufficient wallet balance.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnprocessableResponse'
 */
// POST /api/escrow/pay-additional
// Mentee locks tokens for a single additional session slot
router.post("/pay-additional", requireRole("mentee"), payAdditional);

module.exports = router;
