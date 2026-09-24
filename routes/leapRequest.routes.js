const express = require("express");
const router = express.Router();

const { authenticate, requirePermission } = require("../middleware/authenticate");
const { PERMISSIONS } = require("../config/permissions");
const { adminAuthenticate } = require("../middleware/adminAuth");
const { leapRequestController } = require("../config/container");
const {
  getMyRequest, createRequest, getAllRequests, approveRequest, rejectRequest,
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

/**
 * @openapi
 * /leap-requests:
 *   get:
 *     tags: [LeapRequests]
 *     summary: List all leap requests (admin)
 *     description: Admin auth token required (separate from user JWT).
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Paginated list of all leap requests.
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
// Admin routes
router.get("/", adminAuthenticate, getAllRequests);

/**
 * @openapi
 * /leap-requests/{id}/approve:
 *   patch:
 *     tags: [LeapRequests]
 *     summary: Approve a leap request (admin)
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
 *         description: Request approved.
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
router.patch("/:id/approve", adminAuthenticate, approveRequest);

/**
 * @openapi
 * /leap-requests/{id}/reject:
 *   patch:
 *     tags: [LeapRequests]
 *     summary: Reject a leap request (admin)
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
 *         description: Request rejected.
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
router.patch("/:id/reject", adminAuthenticate, rejectRequest);

module.exports = router;