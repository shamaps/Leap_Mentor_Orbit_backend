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

router.post("/register", registerLimiter, validate(registerSchema), register);
router.post("/login", loginLimiter, validate(loginSchema), login);
router.post("/google", oauthLimiter, googleAuth);
router.post("/clerk-sso", oauthLimiter, clerkSSO);
router.patch("/password", authenticate, changePassword);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.post("/forgot-password", forgotPasswordLimiter, validate(forgotPasswordSchema), sendForgotPasswordOTP);
router.post("/verify-reset-otp", otpLimiter, validate(verifyOtpSchema), verifyResetOTP);
router.post("/reset-password", forgotPasswordLimiter, validate(resetPasswordSchema), resetPassword);

module.exports = router;