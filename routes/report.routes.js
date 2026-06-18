// backend/routes/report.routes.js
const express = require("express");
const router  = express.Router();

const { authenticate, requireRole } = require("../middleware/authenticate");
const { upload }                    = require("../middleware/upload.middleware");
const { reportController } = require("../config/container");
const {
  submitReport, getMyReport, getAllReports, updateReportStatus,
} = reportController;
const { reportLimiter } = require("../middleware/rateLimiter");
// ── User routes (mentor / mentee) ─────────────────────────────

// Submit a report (with optional screenshot upload)
router.post(
  "/",
  authenticate,
  requireRole("mentor", "mentee"),
  upload.single("screenshot"),
  reportLimiter,
  submitReport
);

// Get current user's own report for a connect request
router.get(
  "/my/:connectRequestId",
  authenticate,
  requireRole("mentor", "mentee"),
  getMyReport
);

// ── Admin routes ──────────────────────────────────────────────

// List all reports (paginated, filterable by status)
router.get(
  "/admin",
  authenticate,
  requireRole("admin"),
  getAllReports
);

// Update report status / add admin note
router.patch(
  "/admin/:reportId",
  authenticate,
  requireRole("admin"),
  updateReportStatus
);

module.exports = router;