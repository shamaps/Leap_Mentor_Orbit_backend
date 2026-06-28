// backend/routes/adminPayments.routes.js
const express = require("express");
const router = express.Router();
const { adminAuthenticate } = require("../middleware/adminAuth");
const { adminPaymentsController } = require("../config/container");
const {
  getPaymentStats, getRevenueChart, getTransactions,
} = adminPaymentsController;
router.use(adminAuthenticate);

/**
 * @openapi
 * /admin/payments/stats:
 *   get:
 *     tags: [AdminPayments]
 *     summary: Get payment stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment stats.
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
router.get("/stats", getPaymentStats);

/**
 * @openapi
 * /admin/payments/chart:
 *   get:
 *     tags: [AdminPayments]
 *     summary: Get revenue chart data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue chart data.
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
router.get("/chart", getRevenueChart);

/**
 * @openapi
 * /admin/payments/transactions:
 *   get:
 *     tags: [AdminPayments]
 *     summary: Get transaction history
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
 *         description: Paginated transaction history.
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
router.get("/transactions", getTransactions);

module.exports = router;
