// services/payments-service/src/routes/admin/index.js
// Payments serves only /api/v1/admin/payments.
const express = require("express");
const router = express.Router();

router.use("/payments", require("../adminPayments.routes"));

module.exports = router;
