// routes/admin/index.js
// Single entry point for all /api/v1/admin routes.
// app.js mounts this once at v1.use("/admin", require("./routes/admin"))
// and all sub-paths are handled here.

const express = require("express");
const router = express.Router();

// Core admin routes — auth, stats, users, engagements, leap-requests
router.use("/", require("../admin.routes"));

// Settings — /admin/settings/*
router.use("/settings", require("../adminSettings.routes"));

// Payments — /admin/payments/*
router.use("/payments", require("../adminPayments.routes"));

// Reports — /admin/reports/*
router.use("/reports", require("../adminReports.routes"));

// Mentor verifications — /admin/mentor-verifications/*
router.use("/mentor-verifications", require("../adminVerification.routes"));

module.exports = router;