// backend/routes/escrow.routes.js
const express = require("express");
const router = express.Router();
const validate = require("@leapmentor/shared/middleware/validate");
const { paySchema } = require("../validators/escrow.validator");
const { authenticate, requirePermission } = require("@leapmentor/shared/middleware/authenticate");
const { PERMISSIONS } = require("@leapmentor/shared/config/permissions");
const { escrowController } = require("../config/container");
const {
    pay, getStatus, getMyWallet, payAdditional, getCommissionRate,
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
router.post("/pay", requirePermission(PERMISSIONS.MANAGE_ESCROW), validate(paySchema), pay);

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
router.get("/status/:requestId", requirePermission(PERMISSIONS.MANAGE_ESCROW), getStatus);

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
router.get("/wallet", requirePermission(PERMISSIONS.MANAGE_ESCROW), getMyWallet);

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
router.post("/pay-additional", requirePermission(PERMISSIONS.MANAGE_ESCROW), payAdditional);

module.exports = router;
