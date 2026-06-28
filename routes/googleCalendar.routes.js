// routes/googleCalendar.routes.js
const express = require("express");
const router = express.Router();
const { googleCalendarController } = require("../config/container");
const {
  getAuthUrl, handleCallback, disconnect, getBusySlots, getEvents,
} = googleCalendarController;
const { authenticate: protect } = require("../middleware/authenticate");

/**
 * @openapi
 * /google-calendar/auth-url:
 *   get:
 *     tags: [GoogleCalendar]
 *     summary: Get the Google OAuth URL to open in a popup
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OAuth URL.
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
 *                         url:
 *                           type: string
 *                           format: uri
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Get OAuth URL to open in popup
router.get("/auth-url", protect, getAuthUrl);

/**
 * @openapi
 * /google-calendar/callback:
 *   get:
 *     tags: [GoogleCalendar]
 *     summary: Google OAuth consent callback (no auth — Google calls this directly)
 *     description: >
 *       Not called by the frontend. Google redirects here after the user grants/denies consent.
 *       Responds with an HTML page containing a nonce-scoped inline script that postMessages the
 *       result to the popup's opener window and closes itself.
 *     parameters:
 *       - name: code
 *         in: query
 *         schema:
 *           type: string
 *       - name: state
 *         in: query
 *         schema:
 *           type: string
 *       - name: error
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: HTML page with a postMessage script (success or error — both return 200 by design).
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 */
// Google redirects here after consent — no auth middleware (Google calls this)
router.get("/callback", handleCallback);

/**
 * @openapi
 * /google-calendar/connection:
 *   delete:
 *     tags: [GoogleCalendar]
 *     summary: Disconnect Google Calendar
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Disconnected. No response body.
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Disconnect Google Calendar
router.delete("/connection", protect, disconnect);

/**
 * @openapi
 * /google-calendar/status:
 *   get:
 *     tags: [GoogleCalendar]
 *     summary: Check whether the mentor's Google Calendar is connected
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Connection status.
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
 *                         connected:
 *                           type: boolean
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
//status
router.get("/status", protect, googleCalendarController.getStatus);

/**
 * @openapi
 * /google-calendar/busy:
 *   get:
 *     tags: [GoogleCalendar]
 *     summary: Get busy windows from the mentor's primary calendar
 *     description: Used by the slot busy badge in the availability UI.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Busy windows.
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
// Fetch busy windows for a date range (used by slot busy badge)
router.get("/busy", protect, getBusySlots);

/**
 * @openapi
 * /google-calendar/events:
 *   get:
 *     tags: [GoogleCalendar]
 *     summary: Get event names across all accessible calendars
 *     description: Deduplicated. Used by the calendar grid tooltip.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: startDate
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *       - name: endDate
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: List of events.
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
// Fetch event names for a date range (used by calendar grid tooltip)
router.get("/events", protect, getEvents);

module.exports = router;
