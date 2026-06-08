// services/forgotPassword.service.js
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const repo = require("../repositories/forgotPassword.repository");

const { logger } = require("@sentry/node");
// ─────────────────────────────────────────────────────────────
// MAILER — created once, reused across all calls
// ─────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Generate a random 6-digit OTP string.
 */
// ✅ crypto.randomInt is cryptographically secure — Math.random() is not safe for OTPs
const makeOtp = () => String(crypto.randomInt(100000, 1000000));

/**
 * Normalize an email address — lowercase + trim.
 * @param {string} email
 */
const normalizeEmail = (email) => String(email).toLowerCase().trim();

/**
 * Build the OTP email HTML.
 * @param {string} otpPlain
 */
const buildOtpEmailHtml = (otpPlain) => `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e2e8f0;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#2563eb,#1d4ed8);padding:28px 32px;">
      <h1 style="color:#fff;font-size:20px;font-weight:700;margin:0;">Reset Your Password</h1>
      <p style="color:rgba(255,255,255,0.8);font-size:13px;margin:6px 0 0;">LeapMentor account recovery</p>
    </div>
    <div style="padding:28px 32px;">
      <p style="font-size:14px;color:#475569;margin:0 0 20px;">
        Use the OTP below to reset your password. It expires in <strong>10 minutes</strong>.
      </p>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
        <p style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1e293b;margin:0;">${otpPlain}</p>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>
`;

// ─────────────────────────────────────────────────────────────
// sendForgotPasswordOTP
// ─────────────────────────────────────────────────────────────

/**
 * Step 1 — Generate and email a 6-digit OTP to the user.
 * Does NOT reveal whether the email exists (security best practice).
 *
 * @param {string} email - raw email from req.body
 * @returns {Promise<void>}
 */
const sendForgotPasswordOTP = async (email) => {
    if (!email)
        throw Object.assign(new Error("email is required"), { status: 400 });

    const normalizedEmail = normalizeEmail(email);
    const user = await repo.findUserByEmail(normalizedEmail);

    // ✅ Security — don't reveal whether email exists
    if (!user) return;

    // Delete any existing OTP, create a fresh one
    await repo.deleteTokensByUser(user._id);

    const otpPlain = makeOtp();
    const otpHash = await bcrypt.hash(otpPlain, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await repo.createToken({ userId: user._id, otpHash, expiresAt });

    await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: user.email,
        subject: "LeapMentor — Reset your password",
        html: buildOtpEmailHtml(otpPlain),
    });
};

// ─────────────────────────────────────────────────────────────
// verifyResetOTP
// ─────────────────────────────────────────────────────────────

/**
 * Step 2 — Verify the OTP submitted by the user.
 * If valid, extends the token expiry by 5 minutes for the reset step.
 *
 * @param {string} email
 * @param {string} otp   - plain OTP entered by user
 * @returns {Promise<string>} normalizedEmail - passed to frontend for step 3
 */
const verifyResetOTP = async (email, otp) => {
    if (!email || !otp)
        throw Object.assign(new Error("email and otp are required"), { status: 400 });

    const normalizedEmail = normalizeEmail(email);
    const user = await repo.findUserByEmail(normalizedEmail);
    if (!user)
        throw Object.assign(new Error("Invalid OTP"), { status: 400 });

    const record = await repo.findTokenByUser(user._id);

    // ✅ Sonar fix: optional chain replaces (!record || !record.otp)
    if (!record?.otp)
        throw Object.assign(new Error("No reset request found. Please request a new OTP."), { status: 400 });

    if (record.expiresAt < new Date()) {
        await repo.deleteTokensByUser(user._id);
        throw Object.assign(new Error("OTP expired. Please request a new one."), { status: 400 });
    }

    const ok = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!ok)
        throw Object.assign(new Error("Invalid OTP"), { status: 400 });

    // ✅ OTP valid — extend expiry for password reset step (5 more minutes)
    record.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await repo.saveToken(record);

    return normalizedEmail;
};

// ─────────────────────────────────────────────────────────────
// resetPassword
// ─────────────────────────────────────────────────────────────

/**
 * Step 3 — Reset the user's password after re-verifying the OTP.
 * Prevents skipping step 2 by re-checking OTP on this step too.
 *
 * @param {string} email
 * @param {string} otp
 * @param {string} newPassword
 * @returns {Promise<void>}
 */
const resetPassword = async (email, otp, newPassword) => {
    if (!email || !otp || !newPassword)
        throw Object.assign(new Error("email, otp and newPassword are required"), { status: 400 });

    if (newPassword.length < 6)
        throw Object.assign(new Error("Password must be at least 6 characters"), { status: 400 });

    const normalizedEmail = normalizeEmail(email);
    const user = await repo.findUserByEmail(normalizedEmail);
    if (!user)
        throw Object.assign(new Error("Invalid request"), { status: 400 });

    const record = await repo.findTokenByUser(user._id);

    // ✅ Sonar fix: optional chain replaces (!record || !record.otp)
    if (!record?.otp)
        throw Object.assign(new Error("Session expired. Please start over."), { status: 400 });

    if (record.expiresAt < new Date()) {
        await repo.deleteTokensByUser(user._id);
        throw Object.assign(new Error("Session expired. Please start over."), { status: 400 });
    }

    // ✅ Re-verify OTP on final step — prevents skipping step 2
    const ok = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!ok)
        throw Object.assign(new Error("Invalid session. Please start over."), { status: 400 });

    // ✅ Hash and save new password
    user.password = await bcrypt.hash(newPassword, 10);
    await repo.saveUser(user);

    // ✅ Clean up token
    await repo.deleteTokensByUser(user._id);
};

module.exports = {
    sendForgotPasswordOTP,
    verifyResetOTP,
    resetPassword,
};