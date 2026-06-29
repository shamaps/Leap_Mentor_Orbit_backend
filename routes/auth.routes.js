// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    verifyOtpSchema,
    resetPasswordSchema,
} = require("../validators/auth.validator");
const {
    loginLimiter,
    registerLimiter,
    oauthLimiter,
    forgotPasswordLimiter,
    otpLimiter,
} = require("../middleware/rateLimiter");
const {
    registerController,
    loginController,
    googleAuthController,
    clerkSSOController,
    changePasswordController,
    forgotPasswordController,
    refreshTokenController,
} = require("../config/container");
const { authenticate } = require("../middleware/authenticate");

const { refresh, logout } = refreshTokenController;
const { register } = registerController;
const { login } = loginController;
const { googleAuth } = googleAuthController;
const { clerkSSO } = clerkSSOController;
const { changePassword } = changePasswordController;
const { sendForgotPasswordOTP, verifyResetOTP, resetPassword } = forgotPasswordController;

/**
 * @openapi
 * /auth/google:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in / sign up via Google OAuth ID token
 *     description: Rate-limited via oauthLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [idToken]
 *             properties:
 *               idToken:
 *                 type: string
 *                 example: "eyJhbGciOiJSUzI1NiIs..."
 *     responses:
 *       200:
 *         description: Authenticated via Google.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Missing or invalid Google ID token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/google", oauthLimiter, googleAuth);

/**
 * @openapi
 * /auth/clerk-sso:
 *   post:
 *     tags: [Auth]
 *     summary: Sign in / sign up via Clerk SSO session token
 *     description: Rate-limited via oauthLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessionToken]
 *             properties:
 *               sessionToken:
 *                 type: string
 *                 example: "sess_abc123..."
 *     responses:
 *       200:
 *         description: Authenticated via Clerk.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Missing or invalid Clerk session token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/clerk-sso", oauthLimiter, clerkSSO);

/**
 * @openapi
 * /auth/password:
 *   patch:
 *     tags: [Auth]
 *     summary: Change password for the logged-in user
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
 *                 minLength: 8
 *                 maxLength: 128
 *                 example: "NewP@ss456"
 *     responses:
 *       200:
 *         description: Password updated.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: New password fails validation, or current password is incorrect.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Missing or invalid access token.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.patch("/password", authenticate, changePassword);

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Exchange a valid refresh token cookie for a new access token
 *     description: Reads the HttpOnly refresh token cookie; no request body.
 *     responses:
 *       200:
 *         description: New access token issued.
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
 *                         accessToken:
 *                           type: string
 *                           example: "eyJhbGciOiJIUzI1NiIs..."
 *       401:
 *         description: Refresh token missing, expired, or revoked.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/refresh", refresh);

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Register a new user
 *     description: Creates a user account as mentor or mentee. Rate-limited via registerLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, email, password, roles, termsAccepted]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 100
 *                 example: "Jane Doe"
 *               email:
 *                 type: string
 *                 format: email
 *                 example: "jane@example.com"
 *               password:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *                 example: "Str0ngP@ss!"
 *               roles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [mentor, mentee]
 *                 minItems: 1
 *                 maxItems: 1
 *                 example: ["mentee"]
 *               termsAccepted:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Account created. An OTP verification email is sent.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Joi validation failed — e.g. missing field, weak password, terms not accepted.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       409:
 *         description: An account with this email already exists.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ConflictResponse'
 */
router.post("/register", registerLimiter, validate(registerSchema), register);

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Log in with email and password
 *     description: >
 *       Authenticates a user and returns an access token in the response body.
 *       A refresh token is set as an HttpOnly cookie. Rate-limited via loginLimiter.
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
 *                 example: "jane@example.com"
 *               password:
 *                 type: string
 *                 example: "Str0ngP@ss!"
 *     responses:
 *       200:
 *         description: Login successful.
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
 *                         message:
 *                           type: string
 *                           example: "Login successful"
 *                         accessToken:
 *                           type: string
 *                           example: "eyJhbGciOiJIUzI1NiIs..."
 *                         user:
 *                           $ref: '#/components/schemas/SanitizedUser'
 *                         isNewUser:
 *                           type: boolean
 *                           example: false
 *       400:
 *         description: Joi validation failed — email/password missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Email not registered, or password incorrect.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: "Invalid credentials"
 *       403:
 *         description: >
 *           Account is blocked, or email not yet verified (response includes
 *           isEmailVerified: false and email for resending OTP).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               blocked:
 *                 value:
 *                   success: false
 *                   message: "Your account has been blocked. Please contact support."
 *               unverified:
 *                 value:
 *                   success: false
 *                   message: "Please verify your email before logging in."
 *                   isEmailVerified: false
 *                   email: "jane@example.com"
 */
router.post("/login", loginLimiter, validate(loginSchema), login);

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Log out the current user
 *     description: Clears the refresh token cookie and invalidates the stored refresh token.
 *     responses:
 *       200:
 *         description: Logged out successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 */
router.post("/logout", logout);

/**
 * @openapi
 * /auth/password-reset:
 *   post:
 *     tags: [Auth]
 *     summary: Request a password reset OTP
 *     description: Sends a 6-digit OTP to the given email. Rate-limited via forgotPasswordLimiter.
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
 *         description: >
 *           OTP sent if the email is registered (response is identical whether or not
 *           the account exists, to avoid email enumeration).
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: Email missing or malformed.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.post("/password-reset", forgotPasswordLimiter, validate(forgotPasswordSchema), sendForgotPasswordOTP);

/**
 * @openapi
 * /auth/password-reset/verification:
 *   post:
 *     tags: [Auth]
 *     summary: Verify the password reset OTP
 *     description: Rate-limited via otpLimiter.
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
 *         description: OTP verified.
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
router.post("/password-reset/verification", otpLimiter, validate(verifyOtpSchema), verifyResetOTP);

/**
 * @openapi
 * /auth/password-reset/confirmation:
 *   post:
 *     tags: [Auth]
 *     summary: Confirm password reset with OTP and set a new password
 *     description: >
 *       Sends { email, otp, newPassword } — NOT a reset token.
 *       Rate-limited via forgotPasswordLimiter.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp, newPassword]
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
 *               newPassword:
 *                 type: string
 *                 minLength: 8
 *                 maxLength: 128
 *                 example: "NewP@ss456"
 *     responses:
 *       200:
 *         description: Password reset successfully.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessEnvelope'
 *       400:
 *         description: OTP invalid/expired, or new password fails validation.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 */
router.post("/password-reset/confirmation", forgotPasswordLimiter, validate(resetPasswordSchema), resetPassword);

module.exports = router;
