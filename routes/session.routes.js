// routes/session.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { sessionController } = require("../config/container");
const {
  getSlots, setMeetingLink, markSlotComplete, addSlot,
  cancelSlot, rescheduleSlot, getMentorAvailability,
} = sessionController;
const validate = require("../middleware/validate");
const { addSlotSchema, meetingLinkSchema, slotStatusSchema } = require("../validators/session.validator");

/**
 * @openapi
 * /sessions/{connectRequestId}/slots:
 *   get:
 *     tags: [Session]
 *     summary: Get all session slots for a connect request
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
 *         description: List of session slots.
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
router.get("/:connectRequestId/slots", authenticate, requireRole("mentor", "mentee"), getSlots);

/**
 * @openapi
 * /sessions/{connectRequestId}/mentor-availability:
 *   get:
 *     tags: [Session]
 *     summary: Get the mentor's availability scoped to a connect request
 *     description: Used when scheduling/rescheduling a slot for an existing session.
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
 *         description: Mentor's availability.
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
router.get("/:connectRequestId/mentor-availability", authenticate, requireRole("mentor", "mentee"), getMentorAvailability);

/**
 * @openapi
 * /sessions/{connectRequestId}/slots/{slotIndex}/meeting-link:
 *   patch:
 *     tags: [Session]
 *     summary: Set the meeting link for a session slot
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: connectRequestId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: slotIndex
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [meetingLink]
 *             properties:
 *               meetingLink:
 *                 type: string
 *                 format: uri
 *                 example: "https://meet.google.com/abc-defg-hij"
 *     responses:
 *       200:
 *         description: Meeting link set.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Meeting link missing or not HTTPS.
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
router.patch("/:connectRequestId/slots/:slotIndex/meeting-link", authenticate, requireRole("mentor", "mentee"), validate(meetingLinkSchema), setMeetingLink);

/**
 * @openapi
 * /sessions/{connectRequestId}/slots:
 *   post:
 *     tags: [Session]
 *     summary: Add an additional session slot
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: connectRequestId
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
 *             required: [date, startTime, endTime]
 *             properties:
 *               date:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *                 example: "2026-07-10"
 *               startTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 example: "14:00"
 *               endTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *                 example: "15:00"
 *               day:
 *                 type: string
 *                 example: "Friday"
 *     responses:
 *       201:
 *         description: Slot added.
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
router.post("/:connectRequestId/slots", authenticate, requireRole("mentor", "mentee"), validate(addSlotSchema), addSlot);

// BEFORE (three separate verb-action routes):
// router.patch("/:connectRequestId/slots/:slotIndex/mark-complete", ...)
// router.patch("/:connectRequestId/slots/:slotIndex/cancel", ...)
// router.patch("/:connectRequestId/slots/:slotIndex/reschedule", ...)

/**
 * @openapi
 * /sessions/{connectRequestId}/slots/{slotIndex}/status:
 *   patch:
 *     tags: [Session]
 *     summary: Mark a slot complete, cancel it, or reschedule it
 *     description: >
 *       Single noun-based endpoint driven by action in the request body, replacing three
 *       separate verb-action routes. reason is only accepted when action="cancel";
 *       date/startTime/endTime are required when action="reschedule".
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: connectRequestId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: slotIndex
 *         in: path
 *         required: true
 *         schema:
 *           type: integer
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
 *                 enum: [complete, cancel, reschedule]
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *               date:
 *                 type: string
 *                 pattern: '^\d{4}-\d{2}-\d{2}$'
 *               startTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *               endTime:
 *                 type: string
 *                 pattern: '^\d{2}:\d{2}$'
 *           examples:
 *             complete:
 *               value: { action: "complete" }
 *             cancel:
 *               value: { action: "cancel", reason: "Mentor unavailable" }
 *             reschedule:
 *               value: { action: "reschedule", date: "2026-07-12", startTime: "16:00", endTime: "17:00" }
 *     responses:
 *       200:
 *         description: Slot status updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed for the given action (e.g. reschedule missing date/time).
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
// AFTER (one noun-based route, action driven by body):
router.patch("/:connectRequestId/slots/:slotIndex/status", authenticate, requireRole("mentor", "mentee"), validate(slotStatusSchema), (req, res, next) => {
  const action = req.body.action;
  if (action === "complete") return markSlotComplete(req, res, next);
  if (action === "cancel") return cancelSlot(req, res, next);
  if (action === "reschedule") return rescheduleSlot(req, res, next);
});

module.exports = router;
