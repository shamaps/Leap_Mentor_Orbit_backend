// routes/availability.routes.js
const express = require("express");
const router = express.Router();
const { availabilityController } = require("../config/container");
const {
  getMyAvailability, createAvailability, updateAvailability,
  getMentorAvailability, deleteAvailability, getAvailableSlots,
} = availabilityController;
const validate = require("../middleware/validate");
const { saveAvailabilitySchema } = require("../validators/availability.validator");
const { authenticate, requireRole } = require("../middleware/authenticate");

/**
 * @openapi
 * /availability/me:
 *   get:
 *     tags: [Availability]
 *     summary: Get the logged-in mentor's own availability
 *     description: Mentor role only.
 *     security:
 *       - bearerAuth: []
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
 *         description: Not a mentor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// ✅ Mentor's own availability (mentor only)
router.get("/me", authenticate, requireRole("mentor"), getMyAvailability);

/**
 * @openapi
 * /availability:
 *   post:
 *     tags: [Availability]
 *     summary: Create the logged-in mentor's availability
 *     description: Mentor role only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timezone, sessionDurations, specificDates]
 *             properties:
 *               timezone:
 *                 type: string
 *                 example: "Asia/Kolkata"
 *               sessionDurations:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   enum: [30, 60, 90]
 *                 example: [30, 60]
 *               specificDates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [date, slots]
 *                   properties:
 *                     date:
 *                       type: string
 *                       pattern: '^\d{4}-\d{2}-\d{2}$'
 *                       example: "2026-07-01"
 *                     slots:
 *                       type: array
 *                       items:
 *                         type: object
 *                         required: [startTime, endTime]
 *                         properties:
 *                           startTime:
 *                             type: string
 *                             pattern: '^\d{2}:\d{2}$'
 *                             example: "09:00"
 *                           endTime:
 *                             type: string
 *                             pattern: '^\d{2}:\d{2}$'
 *                             example: "10:00"
 *               googleCalendarConnected:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Availability created.
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
 *         description: Not a mentor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", authenticate, requireRole("mentor"), validate(saveAvailabilitySchema), createAvailability);

/**
 * @openapi
 * /availability/me:
 *   patch:
 *     tags: [Availability]
 *     summary: Update the logged-in mentor's availability
 *     description: Mentor role only.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [timezone, sessionDurations, specificDates]
 *             properties:
 *               timezone:
 *                 type: string
 *               sessionDurations:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   enum: [30, 60, 90]
 *               specificDates:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Availability updated.
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
 *         description: Not a mentor.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/me", authenticate, requireRole("mentor"), validate(saveAvailabilitySchema), updateAvailability);

/**
 * @openapi
 * /availability/me:
 *   delete:
 *     tags: [Availability]
 *     summary: Delete the logged-in mentor's availability
 *     description: Mentor role only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Availability deleted.
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
router.delete("/me", authenticate, requireRole("mentor"), deleteAvailability);

/**
 * @openapi
 * /availability/{mentorId}/slots:
 *   get:
 *     tags: [Availability]
 *     summary: Get a mentor's available booking slots
 *     description: Mentee role only. Used during the booking flow.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: mentorId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Available slots.
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
// ✅ Mentee views a mentor's available slots for booking
router.get("/:mentorId/slots", authenticate, requireRole("mentee"), getAvailableSlots);

/**
 * @openapi
 * /availability/{mentorId}:
 *   get:
 *     tags: [Availability]
 *     summary: Get a mentor's availability (public)
 *     description: No authentication required.
 *     parameters:
 *       - name: mentorId
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
 *       404:
 *         description: Mentor or availability not found.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// ✅ Public — no auth needed
router.get("/:mentorId", getMentorAvailability);

module.exports = router;
