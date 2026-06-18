// backend/routes/adminReports.routes.js
const express = require("express");
const router  = express.Router();
const { adminAuthenticate } = require("../middleware/adminAuth");
const { adminReportsController } = require("../config/container");
const {
  getReportStats, getReports, handleReport, processRefund, deleteSession,
} = adminReportsController;
router.use(adminAuthenticate);

router.get(    "/stats",          getReportStats);
router.get(    "/",               getReports);
router.patch(  "/:id",            handleReport);
router.post(   "/:id/refund",     processRefund);   // ✅ process refund
router.delete( "/:id/session",    deleteSession);   // ✅ delete connect request

module.exports = router;