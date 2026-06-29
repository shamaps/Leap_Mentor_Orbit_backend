// backend/routes/report.routes.js
const express = require("express");
const router = express.Router();

const { authenticate, requireRole } = require("../middleware/authenticate");
const { upload } = require("../middleware/upload.middleware");
const { reportController } = require("../config/container");
const {
  submitReport, getMyReport, getAllReports, updateReportStatus,
} = reportController;
const { reportLimiter } = require("../middleware/rateLimiter");
// ── User routes (mentor / mentee) ─────────────────────────────

/**
 * @openapi
 * /reports:
 *   post:
 *     tags: [Reports]
 *     summary: Submit a dispute / misconduct report
 *     description: Mentor or mentee role. Accepts an optional screenshot upload. Rate-limited via reportLimiter.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [connectRequestId, reason]
 *             properties:
 *               connectRequestId:
 *                 type: string
 *               reason:
 *                 type: string
 *                 example: "No-show"
 *               description:
 *                 type: string
 *               screenshot:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Report submitted.
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
 *         description: Role not permitted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Submit a report (with optional screenshot upload)
router.post(
  "/",
  authenticate,
  requireRole("mentor", "mentee"),
  upload.single("screenshot"),
  reportLimiter,
  submitReport
);

/**
 * @openapi
 * /reports/my/{connectRequestId}:
 *   get:
 *     tags: [Reports]
 *     summary: Get the logged-in user's own report for a connect request
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
 *         description: Own report for this session.
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
 *         description: Role not permitted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Get current user's own report for a connect request
router.get(
  "/my/:connectRequestId",
  authenticate,
  requireRole("mentor", "mentee"),
  getMyReport
);

// ── Admin routes ──────────────────────────────────────────────

/**
 * @openapi
 * /reports/admin:
 *   get:
 *     tags: [Reports]
 *     summary: List all reports (admin)
 *     description: Admin role only. Paginated, filterable by status.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
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
 *         description: Paginated list of all reports.
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
 *         description: Not an admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// List all reports (paginated, filterable by status)
router.get(
  "/admin",
  authenticate,
  requireRole("admin"),
  getAllReports
);

/**
 * @openapi
 * /reports/admin/{reportId}:
 *   patch:
 *     tags: [Reports]
 *     summary: Update report status / add admin note
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: reportId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, reviewing, resolved, dismissed]
 *               adminNote:
 *                 type: string
 *                 maxLength: 1000
 *     responses:
 *       200:
 *         description: Report updated.
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
 *         description: Not an admin.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Update report status / add admin note
router.patch(
  "/admin/:reportId",
  authenticate,
  requireRole("admin"),
  updateReportStatus
);

module.exports = router;
