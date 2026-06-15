const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const repo = require("../repositories/verification.repository");
const transporter = require("../utils/mailer");
const logger = require("../utils/logger");
const { makeOtp } = require("../utils/auth.utils");

const makeLinkToken = () => crypto.randomBytes(32).toString("hex");

/**
 * Generates OTP + magic link, saves BOTH to DB, sends ONE email with both options.
 */
const sendVerificationEmail = async (user, subjectSuffix = "") => {
    await repo.deleteTokensByUser(user._id);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    const otpPlain = makeOtp();
    const tokenPlain = makeLinkToken();

    const [otpHash, tokenHash] = await Promise.all([
        bcrypt.hash(otpPlain, 10),
        bcrypt.hash(tokenPlain, 10),
    ]);

    await repo.createVerificationToken({ user: user._id, otp: otpHash, token: tokenHash, expiresAt });

    const base = process.env.APP_BASE_URL;
if (!base){
    throw new Error("APP_BASE_URL is not set");
}
    const magicLink = `${base}/verify-email?token=${tokenPlain}&email=${encodeURIComponent(user.email)}`;

    await transporter.sendMail({
        from: process.env.FROM_EMAIL,
        to: user.email,
        subject: `LeapMentor Email Verification${subjectSuffix}`,
        text: `
Verify your LeapMentor account

Option 1 – Click the magic link (expires in 10 minutes):
${magicLink}

Option 2 – Enter this OTP manually (expires in 10 minutes):
${otpPlain}
    `.trim(),
        html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto">
        <h2 style="color:#4F46E5">Verify your LeapMentor account</h2>
        <p>Use either option — both expire in <strong>10 minutes</strong>.</p>

        <h3>Option 1 — Magic Link</h3>
        <a href="${magicLink}" style="display:inline-block;padding:12px 24px;background:#4F46E5;color:#fff;border-radius:6px;text-decoration:none;font-weight:bold">
          Verify my email
        </a>
        <p style="font-size:12px;color:#6B7280">Or copy: ${magicLink}</p>

        <hr style="margin:24px 0"/>

        <h3>Option 2 — OTP</h3>
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111">${otpPlain}</p>
        <p style="font-size:13px;color:#6B7280">Enter this on the verification screen.</p>
      </div>
    `,
    });
};

// ─────────────────────────────────────────────────────────────

const sendVerification = async ({ email }) => {
    if (!email) return { status: 400, body: { message: "email is required" } };

    const user = await repo.findUserByEmail(email);
    if (!user) return { status: 404, body: { message: "User not found" } };
    if (user.isEmailVerified) return { status: 400, body: { message: "Email is already verified" } };

    await sendVerificationEmail(user);
    return { status: 200, body: { message: "Verification email sent (OTP + magic link)" } };
};

const resendVerification = async ({ email }) => {
    if (!email) return { status: 400, body: { message: "email is required" } };

    const user = await repo.findUserByEmail(email);
    if (!user) return { status: 404, body: { message: "User not found" } };
    if (user.isEmailVerified) return { status: 400, body: { message: "Email is already verified" } };

    await sendVerificationEmail(user, " (Resend)");
    return { status: 200, body: { message: "Verification email resent (OTP + magic link)" } };
};

const verifyOtp = async ({ email, otp }) => {
    if (!email || !otp) return { status: 400, body: { message: "email and otp are required" } };

    const user = await repo.findUserByEmail(email);
    if (!user) return { status: 404, body: { message: "User not found" } };

    const record = await repo.findTokenByUser(user._id);
    if (!record) return { status: 400, body: { message: "No verification request found" } };

    if (record.expiresAt < new Date()) {
        await repo.deleteTokensByUser(user._id);
        return { status: 400, body: { message: "OTP expired. Please resend." } };
    }

    const ok = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!ok) return { status: 400, body: { message: "Invalid OTP" } };

    await repo.markEmailVerified(user);
    await repo.deleteTokensByUser(user._id);
    return { status: 200, body: { message: "Email verified successfully" } };
};

const verifyLink = async ({ token, email }) => {
    if (!token || !email) return { status: 400, body: { message: "token and email are required" } };

    const user = await repo.findUserByEmail(email);
    if (!user) return { status: 404, body: { message: "User not found" } };

    const record = await repo.findTokenByUser(user._id);
    if (!record) return { status: 400, body: { message: "No verification request found" } };

    if (record.expiresAt < new Date()) {
        await repo.deleteTokensByUser(user._id);
        return { status: 400, body: { message: "Link expired. Please resend" } };
    }

    const ok = await bcrypt.compare(String(token).trim(), record.token);
    if (!ok) return { status: 400, body: { message: "Invalid verification token" } };

    await repo.markEmailVerified(user);
    await repo.deleteTokensByUser(user._id);
    return { status: 200, body: { message: "Email verified successfully", role: user.role } };
};

module.exports = {
    sendVerification,
    resendVerification,
    verifyOtp,
    verifyLink,
};