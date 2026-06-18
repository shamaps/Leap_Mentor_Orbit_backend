// backend/routes/earnings.routes.js
const express = require("express");
const router  = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { earningsController } = require("../config/container");
const {
  getEarningsSummary, getEarningsChart, getPayoutHistory, withdrawEarnings,
} = earningsController;

router.get(  "/",        authenticate, requireRole("mentor"), getEarningsSummary);
router.get(  "/chart",   authenticate, requireRole("mentor"), getEarningsChart);
router.get(  "/payouts", authenticate, requireRole("mentor"), getPayoutHistory);
router.post( "/withdraw",authenticate, requireRole("mentor"), withdrawEarnings);

module.exports = router;