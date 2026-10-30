const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const emailQueue = require("@leapmentor/shared/utils/emailQueue");
const { makeOtp } = require("../utils/auth.utils");
const config = require("@leapmentor/shared/config/env");
const AppError = require("@leapmentor/shared/utils/appError");
const makeLinkToken = () => crypto.randomBytes(32).toString("hex");
const createVerificationService = (repo) => {
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

    const base = config.appBaseUrl;
    if (!base) throw new AppError(500, "APP_BASE_URL is not configured");
    const magicLink = `${base}/verify-email?token=${tokenPlain}&email=${encodeURIComponent(user.email)}`;

    await emailQueue.sendVerificationOtpEmail({
        toEmail: user.email,
        otp: otpPlain,
        magicLink,
        subjectSuffix,
    });
};


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

    return { sendVerification, resendVerification, verifyOtp, verifyLink };
};
module.exports = createVerificationService;