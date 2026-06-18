// backend/routes/invoice.routes.js
const express = require("express");
const { invoiceController } = require("../config/container");
const { downloadInvoice } = invoiceController;
const {authenticate} = require("../middleware/authenticate"); // adjust path if different

const router = express.Router();

// GET /api/invoices/:connectRequestId  — download invoice PDF
router.get("/:connectRequestId", authenticate, downloadInvoice);

module.exports = router;