// backend/routes/adminPayments.routes.js
const express = require("express");
const router  = express.Router();
const { adminAuthenticate } = require("../middleware/adminAuth");
const { adminPaymentsController } = require("../config/container");
const {
  getPaymentStats, getRevenueChart, getTransactions,
} = adminPaymentsController;
router.use(adminAuthenticate);

router.get("/stats",        getPaymentStats);
router.get("/chart",        getRevenueChart);
router.get("/transactions", getTransactions);

module.exports = router;