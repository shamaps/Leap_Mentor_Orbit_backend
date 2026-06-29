// backend/routes/invoice.routes.js
const express = require("express");
const { invoiceController } = require("../config/container");
const { downloadInvoice } = invoiceController;
const { authenticate } = require("../middleware/authenticate"); // adjust path if different

const router = express.Router();

/**
 * @openapi
 * /invoices/{connectRequestId}:
 *   get:
 *     tags: [Invoices]
 *     summary: Download the PDF invoice for a paid session
 *     description: Only accessible by the mentee who made the payment. Returns a raw PDF binary.
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
 *         description: PDF invoice file.
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Not the mentee who made this payment.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: No invoice found for this connect request.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// GET /api/invoices/:connectRequestId  — download invoice PDF
router.get("/:connectRequestId", authenticate, downloadInvoice);

module.exports = router;
