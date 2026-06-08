const express = require("express");
const router = express.Router();
const {
  sendVerification,
  resendVerification,
  verifyOtp,
  verifyLink,
} = require("../controllers/verification.controller");
const { otpLimiter, resendLimiter } = require("../middleware/rateLimiter");
router.post("/send", otpLimiter, sendVerification);       // POST /api/verification/send
router.post("/resend", resendLimiter, resendVerification);   // POST /api/verification/resend
router.post("/verify-otp", otpLimiter, verifyOtp);        // POST /api/verification/verify-otp
router.get("/verify/:token", verifyLink);     // GET  /api/verification/verify/:token?email=...

module.exports = router;