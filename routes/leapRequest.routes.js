const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../middleware/authenticate");
const { PERMISSIONS } = require("../config/permissions");
const { leapRequestController } = require("../config/container");
const {
  getMyRequest, createRequest,
} = leapRequestController;

/**
 * @openapi
 * /leap-requests/my-request:
 *   get:
 *     tags: [LeapRequests]
 *     summary: Get the logged-in mentee's latest leap request
 *     description: Mentee role only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Latest own request.
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
 */
// Mentor routes — only mentors submit leap (verification) requests
router.get("/my-request", authenticate, requirePermission(PERMISSIONS.MANAGE_LEAP_REQUEST), getMyRequest);

/**
 * @openapi
 * /leap-requests:
 *   post:
 *     tags: [LeapRequests]
 *     summary: Create a new leap (wallet top-up) request
 *     description: Mentee role only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       201:
 *         description: Request created.
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
 *         description: A pending request already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnprocessableResponse'
 */
router.post("/", authenticate, requirePermission(PERMISSIONS.MANAGE_LEAP_REQUEST), createRequest);

module.exports = router;
