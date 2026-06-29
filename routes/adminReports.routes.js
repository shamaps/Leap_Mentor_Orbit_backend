// backend/routes/adminReports.routes.js
const express = require("express");
const router = express.Router();
const { adminAuthenticate } = require("../middleware/adminAuth");
const { adminReportsController } = require("../config/container");
const {
  getReportStats, getReports, handleReport, processRefund, deleteSession,
} = adminReportsController;
router.use(adminAuthenticate);

/**
 * @openapi
 * /admin/reports/stats:
 *   get:
 *     tags: [AdminReports]
 *     summary: Get report stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Report stats.
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
router.get("/stats", getReportStats);

/**
 * @openapi
 * /admin/reports/:
 *   get:
 *     tags: [AdminReports]
 *     summary: List all reports
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
 *         description: Paginated list of reports.
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
router.get("/", getReports);

/**
 * @openapi
 * /admin/reports/{id}:
 *   patch:
 *     tags: [AdminReports]
 *     summary: Update report status / handle report
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
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
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/:id", handleReport);

/**
 * @openapi
 * /admin/reports/{id}/refund:
 *   post:
 *     tags: [AdminReports]
 *     summary: Process a refund for a reported session
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
 *         description: Refund processed.
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
 *       422:
 *         description: Escrow already refunded or released.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnprocessableResponse'
 */
router.post("/:id/refund", processRefund);   //  process refund

/**
 * @openapi
 * /admin/reports/{id}/session:
 *   delete:
 *     tags: [AdminReports]
 *     summary: Delete the connect request/session associated with a report
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
 *         description: Session deleted.
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
router.delete("/:id/session", deleteSession);   //  delete connect request

module.exports = router;
