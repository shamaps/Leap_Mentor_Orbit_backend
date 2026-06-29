// services/forgotPassword.service.js
const crypto = require("node:crypto");
const bcrypt = require("bcryptjs");
const transporter = require("../utils/mailer");
const AppError = require("../utils/appError");
const { makeOtp } = require("../utils/auth.utils");
const config = require("../config/env");

/**
 * @typedef {Object} VerificationTokenDocument
 * @property {any} user - Object identifier linking the target user.
 * @property {string} otp - The bcrypt-hashed One-Time Password string.
 * @property {Date} expiresAt - Timestamp marking token validation boundary constraints.
 * @property {Function} save - Persists mutations back to database storage.
 */

/**
 * @typedef {Object} ForgotPasswordRepository
 * @property {(normalizedEmail: string) => Promise<Object|null>} findUserByEmail - Resolves full user profile rows.
 * @property {(user: Object) => Promise<Object>} saveUser - Persists user schema updates.
 * @property {(userId: any) => Promise<VerificationTokenDocument|null>} findTokenByUser - Locates an active validation model.
 * @property {(userId: any) => Promise<Object>} deleteTokensByUser - Purges active OTP structures.
 * @property {(data: {userId: any, otpHash: string, expiresAt: Date}) => Promise<Object>} createToken - Creates a fresh recovery token.
 * @property {(record: VerificationTokenDocument) => Promise<Object>} saveToken - Saves token expiry updates.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function constructing the core password recovery service infrastructure.
 * * @param {ForgotPasswordRepository} repo - Database abstraction data layer instance.
 * @param {{ logger: Logger }} dependencies - Application telemetry and analytics logging wrapper.
 * @returns {Object} Grouped business validation methodologies map configuration.
 */
const createForgotPasswordService = (repo, { logger }) => {

    /**
     * Standardizes dynamic text inputs removing variant discrepancies.
     * * @private
     * @function normalizeEmail
     * @param {string} email - Raw text candidate address.
     * @returns {string} Lowercased, whitespace-trimmed string configuration.
     */
    const normalizeEmail = (email) => String(email).toLowerCase().trim();

    /**
     * Unified validation evaluator assessing account existence and token lifecycle timelines.
     * * @private
     * @async
     * @function getUserWithValidToken
     * @param {string} normalizedEmail - Clean case-insensitive address identifier string.
     * @param {Object} dynamicMessages - Contextual error label configuration variables.
     * @param {string} dynamicMessages.notFoundMsg - String thrown if entity data rows return empty.
     * @param {string} dynamicMessages.expiredMsg - String thrown if date bounds indicate lifecycle completion.
     * @throws {AppError} 400 - If records are absent, token otp mappings are missing, or expirations have passed.
     * @returns {Promise<{user: Object, record: VerificationTokenDocument}>} Active document matching pair records.
     */
    const getUserWithValidToken = async (normalizedEmail, { notFoundMsg, expiredMsg }) => {
        const user = await repo.findUserByEmail(normalizedEmail);
        if (!user) throw new AppError(400, notFoundMsg);

        const record = await repo.findTokenByUser(user._id);
        if (!record?.otp) throw new AppError(400, notFoundMsg);

        if (record.expiresAt < new Date()) {
            await repo.deleteTokensByUser(user._id);
            throw new AppError(400, expiredMsg);
        }

        return { user, record };
    };

    /**
     * Assembles literal recovery presentation HTML structures containing authentication tokens.
     * * @private
     * @function buildOtpEmailHtml
     * @param {string} otpPlain - Raw plaintext numeric characters sequence.
     * @returns {string} Fully prepared inline styles layout markup document.
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

    /**
     * Step 1 — Initiates recovery workflow by generating a transient verification record and emailing it to the user.
     * Implements security isolation bounds to prevent database enumeration vectors.
     * * @async
     * @function sendForgotPasswordOTP
     * @param {string} email - Inbound un-normalized address literal.
     * @throws {AppError} 400 - If dynamic input argument evaluation resolves as completely empty.
     * @returns {Promise<void>} Resolves tracking steps on skipped paths or completed mailing updates.
     */
    const sendForgotPasswordOTP = async (email) => {
        if (!email)
            throw new AppError(400, "email is required");

        const normalizedEmail = normalizeEmail(email);
        const user = await repo.findUserByEmail(normalizedEmail);

        if (!user) return;

        await repo.deleteTokensByUser(user._id);

        const otpPlain = makeOtp();
        const otpHash = await bcrypt.hash(otpPlain, 10);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await repo.createToken({ userId: user._id, otpHash, expiresAt });

        await transporter.sendMail({
            from: config.fromEmail,
            to: user.email,
            subject: "LeapMentor — Reset your password",
            html: buildOtpEmailHtml(otpPlain),
        });
    };

    /**
     * Step 2 — Assesses plaintext numeric assertions, validating matching integrity signatures.
     * Extends expiration dates to enable secure password mutation windows.
     * * @async
     * @function verifyResetOTP
     * @param {Object} verificationData - Input parameters checking token strings.
     * @param {string} verificationData.email - Un-normalized context address criteria string.
     * @param {string} verificationData.otp - Raw numeric characters payload parameter.
     * @throws {AppError} 400 - If data inputs are missing or crypto match verifications fail.
     * @returns {Promise<string>} Normalized identity string returned to presentation clients.
     */
    const verifyResetOTP = async ({ email, otp }) => {
        if (!email || !otp)
            throw new AppError(400, "email and otp are required");

        const normalizedEmail = normalizeEmail(email);
        const { record } = await getUserWithValidToken(normalizedEmail, {
            notFoundMsg: "Invalid OTP",
            expiredMsg: "OTP expired. Please request a new one.",
        });

        const ok = await bcrypt.compare(String(otp).trim(), record.otp);
        if (!ok) throw new AppError(400, "Invalid OTP");

        record.expiresAt = new Date(Date.now() + 5 * 60 * 1000);
        await repo.saveToken(record);
        return normalizedEmail;
    };

    /**
     * Step 3 — Finalizes workflow execution, crypto-hashing and overwriting old persistent password variables.
     * Re-verifies structural security tokens to prevent bypass vulnerabilities.
     * * @async
     * @function resetPassword
     * @param {Object} data - Mutator parameters package context container.
     * @param {string} data.email - Un-normalized user reference criteria.
     * @param {string} data.otp - Validation structural confirmation code.
     * @param {string} data.newPassword - Raw replacement string target credential.
     * @throws {AppError} 400 - If fields are empty, password complexity lengths fail floor checks, or token validations drop.
     * @returns {Promise<void>} Processing resolves on successful updates and token cleanups.
     */
    const resetPassword = async ({ email, otp, newPassword }) => {
        if (!email || !otp || !newPassword)
            throw new AppError(400, "email, otp and newPassword are required");
        if (newPassword.length < 6)
            throw new AppError(400, "Password must be at least 6 characters");

        const normalizedEmail = normalizeEmail(email);
        const { user, record } = await getUserWithValidToken(normalizedEmail, {
            notFoundMsg: "Invalid request",
            expiredMsg: "Session expired. Please start over.",
        });

        const ok = await bcrypt.compare(String(otp).trim(), record.otp);
        if (!ok) throw new AppError(400, "Invalid session. Please start over.");

        user.password = await bcrypt.hash(newPassword, 10);
        await repo.saveUser(user);
        await repo.deleteTokensByUser(user._id);
    };

    return { sendForgotPasswordOTP, verifyResetOTP, resetPassword };
};

module.exports = createForgotPasswordService;