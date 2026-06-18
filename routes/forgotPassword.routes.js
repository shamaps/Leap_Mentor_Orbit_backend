// backend/routes/forgotPassword.routes.js
const express = require("express");
const {
  forgotPasswordController,
} = require("../config/container");

const { sendForgotPasswordOTP, verifyResetOTP, resetPassword } = forgotPasswordController;

const router = express.Router();

// POST /api/auth/forgot-password    → send OTP to email
router.post("/forgot-password", sendForgotPasswordOTP);

// POST /api/auth/verify-reset-otp   → verify OTP
router.post("/verify-reset-otp", verifyResetOTP);

// POST /api/auth/reset-password     → set new password
router.post("/reset-password", resetPassword);

module.exports = router;