const express = require("express");
const router = express.Router();
const {
  verificationController,
} = require("../config/container");
const validate = require("../middleware/validate");
const { verifyOtpSchema } = require("../validators/auth.validator");
const { sendVerification, resendVerification, verifyOtp, verifyLink } = verificationController;
const { otpLimiter, resendLimiter } = require("../middleware/rateLimiter");
router.post("/send", otpLimiter, sendVerification);       // POST /api/verification/send
router.post("/resend", resendLimiter, resendVerification);   // POST /api/verification/resend
router.post("/verify-otp", validate(verifyOtpSchema), verificationController.verifyOtp);      // POST /api/verification/verify-otp
router.get("/verify/:token", verifyLink);     // GET  /api/verification/verify/:token?email=...

module.exports = router;


