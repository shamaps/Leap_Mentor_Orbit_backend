const express = require("express");
const router = express.Router();
const {
  verificationController,
} = require("../config/container");
const validate = require("../middleware/validate");
const { verifyOtpSchema } = require("../validators/auth.validator");
const { sendVerification, resendVerification, verifyOtp, verifyLink } = verificationController;
const { otpLimiter, resendLimiter } = require("../middleware/rateLimiter");
/**
 * @openapi
 * /verification/send:
 *   post:
 *     tags: [Verification]
 *     summary: Send an email OTP for account verification
 *     description: Rate-limited via otpLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane@example.com"
 *     responses:
 *       200:
 *         description: OTP sent.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Email missing/invalid, or already verified.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/send", otpLimiter, sendVerification);       // POST /api/verification/send
/**
 * @openapi
 * /verification/resend:
 *   post:
 *     tags: [Verification]
 *     summary: Resend the email OTP
 *     description: Rate-limited via resendLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane@example.com"
 *     responses:
 *       200:
 *         description: OTP resent.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Email missing/invalid, resend cooldown still active, or already verified.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/resend", resendLimiter, resendVerification);   // POST /api/verification/resend
/**
 * @openapi
 * /verification/verify-otp:
 *   post:
 *     tags: [Verification]
 *     summary: Verify the email OTP
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane@example.com"
 *               otp:
 *                 type: string
 *                 minLength: 6
 *                 maxLength: 6
 *                 example: "482913"
 *     responses:
 *       200:
 *         description: Email verified.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: OTP missing, malformed, expired, or incorrect.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.post("/verify-otp", validate(verifyOtpSchema), verificationController.verifyOtp);      // POST /api/verification/verify-otp
/**
 * @openapi
 * /verification/verify/{token}:
 *   get:
 *     tags: [Verification]
 *     summary: Verify email via link token
 *     description: Used for the email-link verification flow (as opposed to OTP). Accepts ?email=... as a query param.
 *     parameters:
 *       - name: token
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *       - name: email
 *         in: query
 *         required: false
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Email verified via link.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Token invalid or expired.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.get("/verify/:token", verifyLink);     // GET  /api/verification/verify/:token?email=...

module.exports = router;


