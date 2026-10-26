// services/engagement-service/src/routes/admin/index.js
// Engagement serves /api/v1/admin/reports, /leap-requests and /engagements.
const express = require("express");
const router = express.Router();

router.use("/reports", require("../adminReports.routes"));
router.use("/leap-requests", require("../adminLeapRequests.routes"));
router.use("/engagements", require("../adminEngagements.routes"));

module.exports = router;