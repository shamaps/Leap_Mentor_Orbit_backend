// backend/routes/adminSettings.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const { changePasswordSchema, addAdminSchema, updateCommissionSchema } = require("../validators/adminSettings.validator");

// Use adminAuthenticate — NOT authenticate + requireRole
const { adminAuthenticate } = require("../middleware/adminAuth");

const { adminSettingsController } = require("../config/container");
const {
  getOverview, changePassword, addAdmin, getCommission, updateCommission,
} = adminSettingsController;

// All routes protected by adminAuthenticate
router.use(adminAuthenticate);

/**
 * @openapi
 * /admin/settings/overview:
 *   get:
 *     tags: [AdminSettings]
 *     summary: Get admin settings overview
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings overview.
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
router.get("/overview", getOverview);

/**
 * @openapi
 * /admin/settings/change-password:
 *   patch:
 *     tags: [AdminSettings]
 *     summary: Change the logged-in admin's password
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 example: "OldP@ss123"
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 128
 *                 example: "NewP@ss456"
 *     responses:
 *       200:
 *         description: Password changed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed, or current password incorrect.
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
router.patch("/change-password", validate(changePasswordSchema), changePassword);

/**
 * @openapi
 * /admin/settings/admins:
 *   post:
 *     tags: [AdminSettings]
 *     summary: Add a new admin account
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "John Admin"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "john.admin@leapmentor.com"
 *     responses:
 *       201:
 *         description: Admin account created.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed.
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
 *       409:
 *         description: An admin with this email already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConflictResponse'
 */
router.post("/admins", validate(addAdminSchema), addAdmin);
/**
 * @openapi
 * /admin/settings/commission:
 *   patch:
 *     tags: [AdminSettings]
 *     summary: Update the platform commission rate
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [commissionRate]
 *             properties:
 *               commissionRate:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 12
 *     responses:
 *       200:
 *         description: Commission rate updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Validation failed — commissionRate must be between 0 and 100.
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
 *   get:
 *     tags: [AdminSettings]
 *     summary: Get the current platform commission rate
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current commission rate.
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
 *                         commissionRate:
 *                           type: number
 *                           example: 10
 *       401:
 *         description: Missing or invalid admin token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/commission", validate(updateCommissionSchema), updateCommission);
router.get("/commission", getCommission);

module.exports = router;