// backend/routes/adminReports.routes.js
const express = require("express");
const router  = express.Router();
const { adminAuthenticate } = require("../middleware/adminAuth");
const { getReportStats, getReports, handleReport } = require("../controllers/admin/adminReports.controller");

router.use(adminAuthenticate);

router.get(  "/stats", getReportStats);
router.get(  "/",      getReports);
router.patch("/:id",   handleReport);

module.exports = router;