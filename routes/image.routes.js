// routes/image.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const { imageController } = require("../config/container");

const { getProfileImage } = imageController;

/**
 * @openapi
 * /images/profile/{userId}:
 *   get:
 *     tags: [Images]
 *     summary: Get a resized profile image URL
 *     description: >
 *       Returns a Cloudinary URL resized to the requested dimensions. Serves the
 *       pre-generated eager variant if available, otherwise generates and caches
 *       it on the fly.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: userId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: w
 *         in: query
 *         schema:
 *           type: integer
 *           default: 80
 *           maximum: 400
 *         description: Width in pixels.
 *       - name: h
 *         in: query
 *         schema:
 *           type: integer
 *           default: 80
 *           maximum: 400
 *         description: Height in pixels.
 *     responses:
 *       200:
 *         description: Resized image URL.
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
 *                         url:
 *                           type: string
 *                           format: uri
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/profile/:userId", authenticate, getProfileImage);

module.exports = router;
