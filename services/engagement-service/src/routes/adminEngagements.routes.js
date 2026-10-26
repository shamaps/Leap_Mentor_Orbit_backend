// services/engagement-service/src/routes/adminEngagements.routes.js
const express = require("express");
const router = express.Router();
const { adminAuthenticate } = require("@leapmentor/shared/middleware/adminAuth");
const { adminEngagementsController } = require("../config/container");
const { getEngagementStats, getEngagements } = adminEngagementsController;

router.use(adminAuthenticate);

/**
 * @openapi
 * /admin/engagements/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get engagement stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Engagement stats.
 *       401:
 *         description: Missing or invalid admin token.
 */
router.get("/stats", getEngagementStats);

/**
 * @openapi
 * /admin/engagements:
 *   get:
 *     tags: [Admin]
 *     summary: List engagements (connect requests / sessions)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of engagements.
 *       401:
 *         description: Missing or invalid admin token.
 */
router.get("/", getEngagements);

module.exports = router;