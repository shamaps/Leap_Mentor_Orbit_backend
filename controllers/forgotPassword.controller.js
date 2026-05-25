// controllers/forgotPassword.controller.js
const service = require("../services/forgotPassword.service");

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 * Sends a 6-digit OTP to the user's email.
 * @returns {Promise<void>}
 */
const sendForgotPasswordOTP = async (req, res, next) => {
  try {
    await service.sendForgotPasswordOTP(req.body.email);

    // ✅ Always return the same message — don't reveal if email exists
    return res.json({ message: "If this email exists, an OTP has been sent." });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/verify-reset-otp
 * Body: { email, otp }
 * Verifies OTP — extends token expiry for password reset step.
 * @returns {Promise<void>}
 */
const verifyResetOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;
    const normalizedEmail = await service.verifyResetOTP(email, otp);

    return res.json({ message: "OTP verified", email: normalizedEmail });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/reset-password
 * Body: { email, otp, newPassword }
 * Resets password after re-verifying OTP.
 * @returns {Promise<void>}
 */
const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;
    await service.resetPassword(email, otp, newPassword);

    return res.json({ message: "Password reset successfully. You can now login." });
  } catch (err) {
    next(err);
  }
};

module.exports = { sendForgotPasswordOTP, verifyResetOTP, resetPassword };