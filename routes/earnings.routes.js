// backend/routes/earnings.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { earningsController } = require("../config/container");
const {
  getEarningsSummary, getEarningsChart, getPayoutHistory, withdrawEarnings,
} = earningsController;

/**
 * @openapi
 * /mentor/earnings:
 *   get:
 *     tags: [Earnings]
 *     summary: Get the mentor's earnings summary
 *     description: Mentor role only. Returns stat cards - totalEarnings, sessionsThisMonth, avgRating, pendingPayout.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Earnings summary.
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
 *                         totalEarnings:
 *                           type: number
 *                           example: 1250
 *                         sessionsThisMonth:
 *                           type: integer
 *                           example: 8
 *                         avgRating:
 *                           type: number
 *                           example: 4.7
 *                         pendingPayout:
 *                           type: number
 *                           example: 200
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
router.get("/", authenticate, requireRole("mentor"), getEarningsSummary);

/**
 * @openapi
 * /mentor/earnings/chart:
 *   get:
 *     tags: [Earnings]
 *     summary: Get earnings chart data
 *     description: Mentor role only.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: period
 *         in: query
 *         schema:
 *           type: string
 *           enum: [weekly, monthly]
 *     responses:
 *       200:
 *         description: Earnings grouped by period.
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
router.get("/chart", authenticate, requireRole("mentor"), getEarningsChart);

/**
 * @openapi
 * /mentor/earnings/payouts:
 *   get:
 *     tags: [Earnings]
 *     summary: Get paginated, searchable payout history
 *     description: Mentor role only.
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
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Paginated payout history.
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
router.get("/payouts", authenticate, requireRole("mentor"), getPayoutHistory);

/**
 * @openapi
 * /mentor/earnings/withdraw:
 *   post:
 *     tags: [Earnings]
 *     summary: Withdraw available earnings balance
 *     description: Mentor role only.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Withdrawal processed.
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
 *       422:
 *         description: No balance available to withdraw.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UnprocessableResponse'
 */
router.post("/withdraw", authenticate, requireRole("mentor"), withdrawEarnings);

module.exports = router;
