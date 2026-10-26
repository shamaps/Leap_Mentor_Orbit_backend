// backend/routes/admin.routes.js
const express = require("express");
const router = express.Router();
const validate = require("@leapmentor/shared/middleware/validate");
const { adminLoginSchema, getUsersQuerySchema } = require("../validators/admin.validator");
const { adminAuthenticate, requireSuperAdmin } = require("@leapmentor/shared/middleware/adminAuth");
const { adminController } = require("../config/container");

const {
  adminLogin, adminLogout, adminMe, getStats, getUsers, getUserDetail,
  deleteUser, blockUser, unblockUser,
  getUserGrowth, getMentorIndustryStats,
} = adminController;

const { adminLoginLimiter } = require("@leapmentor/shared/middleware/rateLimiter");

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
 *       401:
 *         description: Missing or invalid admin token.
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
router.delete("/users/:userId", adminAuthenticate, requireSuperAdmin, deleteUser);

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

module.exports = router;
