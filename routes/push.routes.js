const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate"); // ✅ fixed
const { pushSubscriptionController } = require("../config/container");
const { subscribe, unsubscribe, getVapidPublicKey } = pushSubscriptionController;

/**
 * @openapi
 * /push/vapid-public-key:
 *   get:
 *     tags: [Push]
 *     summary: Get the VAPID public key for Web Push subscription
 *     description: No authentication required — needed by the browser before the user is necessarily logged in.
 *     responses:
 *       200:
 *         description: VAPID public key.
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
 *                         publicKey:
 *                           type: string
 */
router.get("/vapid-public-key", getVapidPublicKey);

/**
 * @openapi
 * /push/subscribe:
 *   post:
 *     tags: [Push]
 *     summary: Subscribe to Web Push notifications
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [endpoint, keys]
 *             properties:
 *               endpoint:
 *                 type: string
 *                 format: uri
 *               keys:
 *                 type: object
 *                 properties:
 *                   p256dh:
 *                     type: string
 *                   auth:
 *                     type: string
 *     responses:
 *       201:
 *         description: Subscription saved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Invalid subscription payload.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/subscribe", authenticate, subscribe);

/**
 * @openapi
 * /push/unsubscribe:
 *   delete:
 *     tags: [Push]
 *     summary: Unsubscribe from Web Push notifications
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unsubscribed.
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
 */
router.delete("/unsubscribe", authenticate, unsubscribe);

module.exports = router;
