// backend/routes/admin.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const { adminLoginSchema, getUsersQuerySchema } = require("../validators/admin.validator");
const { adminAuthenticate } = require("../middleware/adminAuth");
const { adminController, leapRequestController } = require("../config/container");

const {
  adminLogin, adminLogout, adminMe, getStats, getUsers, getUserDetail,
  deleteUser, blockUser, unblockUser, getEngagementStats, getEngagements,
  getUserGrowth, getMentorIndustryStats,
} = adminController;

const {
  getAllRequests, getPendingCount, approveRequest, rejectRequest,
} = leapRequestController;

const { adminLoginLimiter } = require("../middleware/rateLimiter");

/**
 * @openapi
 * /admin/auth/login:
 *   post:
 *     tags: [Admin]
 *     summary: Admin login
 *     description: Separate admin token, distinct from the user JWT. Rate-limited via adminLoginLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "admin@leapmentor.com"
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin logged in.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed or invalid credentials.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
// Auth (public)
router.post("/auth/login", adminLoginLimiter, validate(adminLoginSchema), adminLogin);

/**
 * @openapi
 * /admin/auth/logout:
 *   post:
 *     tags: [Admin]
 *     summary: Admin logout
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/auth/logout", adminAuthenticate, adminLogout);

/**
 * @openapi
 * /admin/auth/me:
 *   get:
 *     tags: [Admin]
 *     summary: Get the logged-in admin's own data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current admin data.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/auth/me", adminAuthenticate, adminMe);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     tags: [Admin]
 *     summary: Get dashboard stats
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Stats
router.get("/stats", adminAuthenticate, getStats);

/**
 * @openapi
 * /admin/user-growth:
 *   get:
 *     tags: [Admin]
 *     summary: Get user growth chart data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User growth over time.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/user-growth", adminAuthenticate, getUserGrowth);

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: List users (search/filter/paginate)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: search
 *         in: query
 *         schema:
 *           type: string
 *           maxLength: 100
 *       - name: role
 *         in: query
 *         schema:
 *           type: string
 *           enum: [mentor, mentee, '']
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *       - name: deleted
 *         in: query
 *         schema:
 *           type: string
 *           enum: ['true', 'false']
 *     responses:
 *       200:
 *         description: Paginated list of users.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Invalid query params.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// User management 
router.get("/users", adminAuthenticate, validate(getUsersQuerySchema, "query"), getUsers);

/**
 * @openapi
 * /admin/users/{userId}:
 *   get:
 *     tags: [Admin]
 *     summary: Get a single user's detail
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User detail.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/users/:userId", adminAuthenticate, getUserDetail);

/**
 * @openapi
 * /admin/users/{userId}:
 *   delete:
 *     tags: [Admin]
 *     summary: Delete a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.delete("/users/:userId", adminAuthenticate, deleteUser);

/**
 * @openapi
 * /admin/users/{userId}/block:
 *   patch:
 *     tags: [Admin]
 *     summary: Block a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User blocked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Block and Unblock routes
router.patch("/users/:userId/block", adminAuthenticate, blockUser);

/**
 * @openapi
 * /admin/users/{userId}/unblock:
 *   patch:
 *     tags: [Admin]
 *     summary: Unblock a user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User unblocked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/users/:userId/unblock", adminAuthenticate, unblockUser);

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// engagements
router.get("/engagements/stats", adminAuthenticate, getEngagementStats);

/**
 * @openapi
 * /admin/stats/mentor-industries:
 *   get:
 *     tags: [Admin]
 *     summary: Get mentor distribution by industry
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Mentor industry stats.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/stats/mentor-industries", adminAuthenticate, getMentorIndustryStats);

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
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/engagements", adminAuthenticate, getEngagements);

/**
 * @openapi
 * /admin/leap-requests:
 *   get:
 *     tags: [Admin]
 *     summary: List all leap requests
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated list of leap requests.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
// Leap / Wallet Requests
router.get("/leap-requests", adminAuthenticate, getAllRequests);

/**
 * @openapi
 * /admin/leap-requests/pending-count:
 *   get:
 *     tags: [Admin]
 *     summary: Get count of pending leap requests (sidebar badge)
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Pending count.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         count:
 *                           type: integer
 *                           example: 4
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/leap-requests/pending-count", adminAuthenticate, getPendingCount);

/**
 * @openapi
 * /admin/leap-requests/{id}/approve:
 *   patch:
 *     tags: [Admin]
 *     summary: Approve a leap request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request approved.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/leap-requests/:id/approve", adminAuthenticate, approveRequest);

/**
 * @openapi
 * /admin/leap-requests/{id}/reject:
 *   patch:
 *     tags: [Admin]
 *     summary: Reject a leap request
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Request rejected.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/leap-requests/:id/reject", adminAuthenticate, rejectRequest);

module.exports = router;
