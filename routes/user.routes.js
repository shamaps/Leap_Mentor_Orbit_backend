// src/routes/user.routes.js
const express = require("express");
const { authenticate } = require("../middleware/authenticate");
const { userController } = require("../config/container");
const router = express.Router();

const { getMe } = userController;

/**
 * @openapi
 * /users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get the logged-in user's own account data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user data.
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessEnvelope'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/SanitizedUser'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/me", authenticate, getMe); // GET /api/users/me — returns logged-in user's own data

module.exports = router;
