// routes/connectRequest.routes.js
const express = require("express");
const router = express.Router();
const { connectRequestController, mentorReferController } = require("../config/container");
const validate = require("../middleware/validate");
const { sendConnectRequestSchema, respondSchema } = require("../validators/connectRequest.validator");

const {
  sendConnectRequest, getMyRequests, getIncomingRequests,
  respondToRequest, cancelRequest, referRequest,
  getOngoingConnects, getConnectDetail,
} = connectRequestController;
const { getSimilarMentors } = mentorReferController;

const { authenticate, requireRole } = require("../middleware/authenticate");

/**
 * @openapi
 * /connect-requests:
 *   post:
 *     tags: [ConnectRequest]
 *     summary: Send a connect request to a mentor
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [mentorId, selectedSlots, sessionRate, sessionCount]
 *             properties:
 *               mentorId:
 *                 type: string
 *                 example: "665f1c2e4b1a2c001f8e9a22"
 *               selectedSlots:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 5
 *                 items:
 *                   type: object
 *                   properties:
 *                     day:
 *                       type: string
 *                       example: "Monday"
 *                     date:
 *                       type: string
 *                       example: "2026-07-06"
 *                     startTime:
 *                       type: string
 *                       example: "09:00"
 *                     endTime:
 *                       type: string
 *                       example: "10:00"
 *               sessionRate:
 *                 type: number
 *                 minimum: 1
 *                 example: 25
 *               sessionCount:
 *                 type: integer
 *                 minimum: 1
 *                 example: 4
 *               message:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       201:
 *         description: Connect request sent.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed — e.g. invalid mentorId, no slots selected, more than 5 slots.
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
 *         description: Logged-in user is not a mentee.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Mentee routes
router.post("/", authenticate, validate(sendConnectRequestSchema), sendConnectRequest);

/**
 * @openapi
 * /connect-requests/my-requests:
 *   get:
 *     tags: [ConnectRequest]
 *     summary: Get the logged-in mentee's sent connect requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of own connect requests.
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
router.get("/my-requests", authenticate, getMyRequests);

/**
 * @openapi
 * /connect-requests/{id}:
 *   delete:
 *     tags: [ConnectRequest]
 *     summary: Cancel a connect request
 *     description: Mentee cancels their own pending request.
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
 *         description: Request cancelled.
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
 *         description: Not the request owner.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/:id", authenticate, cancelRequest);

/**
 * @openapi
 * /connect-requests/incoming:
 *   get:
 *     tags: [ConnectRequest]
 *     summary: Get the logged-in mentor's incoming connect requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of incoming connect requests.
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
// Mentor routes
router.get("/incoming", authenticate, getIncomingRequests);

/**
 * @openapi
 * /connect-requests/{id}/similar-mentors:
 *   get:
 *     tags: [ConnectRequest]
 *     summary: Get similar mentors to refer a mentee to
 *     description: Mentor role only.
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
 *         description: List of similar mentors.
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
 */
// SPECIFIC routes BEFORE generic /:id  <-- THIS WAS THE BUG
router.get("/:id/similar-mentors", authenticate, requireRole("mentor"), getSimilarMentors);

/**
 * @openapi
 * /connect-requests/{id}/refer:
 *   patch:
 *     tags: [ConnectRequest]
 *     summary: Refer a connect request to another mentor
 *     description: Mentor role only.
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
 *         description: Request referred.
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
 */
router.patch("/:id/refer", authenticate, requireRole("mentor"), referRequest);

/**
 * @openapi
 * /connect-requests/{id}/detail:
 *   get:
 *     tags: [ConnectRequest]
 *     summary: Get full detail for a connect request
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
 *         description: Connect request detail.
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
router.get("/:id/detail", authenticate, getConnectDetail);

/**
 * @openapi
 * /connect-requests/ongoing:
 *   get:
 *     tags: [ConnectRequest]
 *     summary: Get the logged-in user's ongoing (accepted) connects
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ongoing connects.
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
router.get("/ongoing", authenticate, getOngoingConnects);

/**
 * @openapi
 * /connect-requests/{id}:
 *   patch:
 *     tags: [ConnectRequest]
 *     summary: Respond to a connect request (accept/reject)
 *     description: Mentor accepts or rejects an incoming request. confirmedSlot is required when status is "accepted".
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [accepted, rejected]
 *               confirmedSlot:
 *                 type: object
 *                 properties:
 *                   day:
 *                     type: string
 *                   date:
 *                     type: string
 *                   startTime:
 *                     type: string
 *                   endTime:
 *                     type: string
 *     responses:
 *       200:
 *         description: Request updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed, or confirmedSlot missing when accepting.
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
 *         description: Not the recipient mentor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Generic /:id LAST
router.patch("/:id", authenticate, validate(respondSchema), respondToRequest);
module.exports = router;
