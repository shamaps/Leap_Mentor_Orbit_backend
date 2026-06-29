// backend/routes/message.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const { messageController } = require("../config/container");
const { getMessages, getUnreadCount } = messageController;

/**
 * @openapi
 * /messages/{connectRequestId}:
 *   get:
 *     tags: [Messages]
 *     summary: Get paginated chat message history for a connect request
 *     description: Uses _id-based cursor pagination.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: connectRequestId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: cursor
 *         in: query
 *         schema:
 *           type: string
 *         description: _id of the last message from the previous page.
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     responses:
 *       200:
 *         description: Paginated message history.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/CursorPage'
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
// GET /api/messages/:connectRequestId         — paginated history
router.get("/:connectRequestId", authenticate, getMessages);

/**
 * @openapi
 * /messages/{connectRequestId}/unread:
 *   get:
 *     tags: [Messages]
 *     summary: Get the unread message count for a connect request
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
 *         description: Unread count.
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
 *                         count:
 *                           type: integer
 *                           example: 3
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /api/messages/:connectRequestId/unread  — unread count
router.get("/:connectRequestId/unread", authenticate, getUnreadCount);

module.exports = router;
