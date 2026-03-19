// backend/routes/adminPayments.routes.js
const express = require("express");
const router  = express.Router();
const { adminAuthenticate } = require("../middleware/adminAuth");
const {
  getPaymentStats,
  getRevenueChart,
  getTransactions,
} = require("../controllers/admin/adminPayments.controller");

router.use(adminAuthenticate);

router.get("/stats",        getPaymentStats);
router.get("/chart",        getRevenueChart);
router.get("/transactions", getTransactions);

module.exports = router;