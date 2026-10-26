// services/engagement-service/src/routes/adminLeapRequests.routes.js
// Admin leap / wallet request review. Moved out of the monolith's admin.routes.js;
// mounted at /api/v1/admin/leap-requests (see routes/admin/index.js).
const express = require("express");
const router = express.Router();
const { adminAuthenticate } = require("@leapmentor/shared/middleware/adminAuth");
const { leapRequestController } = require("../config/container");

const { getAllRequests, getPendingCount, approveRequest, rejectRequest } = leapRequestController;

/**
 * @openapi
 * /admin/leap-requests:
 *   get:
 *     tags: [Admin]
 *     summary: List leap requests
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Leap requests }
 */
router.get("/", adminAuthenticate, getAllRequests);

/**
 * @openapi
 * /admin/leap-requests/pending-count:
 *   get:
 *     tags: [Admin]
 *     summary: Count pending leap requests
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Pending count }
 */
router.get("/pending-count", adminAuthenticate, getPendingCount);

/**
 * @openapi
 * /admin/leap-requests/{id}/approve:
 *   patch:
 *     tags: [Admin]
 *     summary: Approve a leap request
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Approved }
 */
router.patch("/:id/approve", adminAuthenticate, approveRequest);

/**
 * @openapi
 * /admin/leap-requests/{id}/reject:
 *   patch:
 *     tags: [Admin]
 *     summary: Reject a leap request
 *     security: [{ cookieAuth: [] }]
 *     responses:
 *       200: { description: Rejected }
 */
router.patch("/:id/reject", adminAuthenticate, rejectRequest);

module.exports = router;
