// shared/utils/emails/authEmails.js
const transporter = require("../mailer");
const config = require("../../config/env");

// NOTE: do NOT wrap these in try/catch. Errors must propagate so the
// email worker can retry and eventually dead-letter the event.

const sendVerificationOtpEmail = async ({
    toEmail,
    otp,
    magicLink,
    subjectSuffix = "",
}) => {
    await transporter.sendMailWithRetry({
        from: config.fromEmail,
        to: toEmail,
        subject: `LeapMentor Email Verification${subjectSuffix}`,
        text: `
Verify your LeapMentor account

Option 1 – Click the magic link (expires in 10 minutes):
${magicLink}

Option 2 – Enter this OTP manually (expires in 10 minutes):
${otp}
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
        <p style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#111">${otp}</p>
        <p style="font-size:13px;color:#6B7280">Enter this on the verification screen.</p>
      </div>
    `,
    });
};

const buildPasswordResetHtml = (otp) => `
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
        <p style="font-size:36px;font-weight:800;letter-spacing:10px;color:#1e293b;margin:0;">${otp}</p>
      </div>
      <p style="font-size:12px;color:#94a3b8;margin:0;">
        If you didn't request this, you can safely ignore this email.
      </p>
    </div>
  </div>
`;

const sendPasswordResetOtpEmail = async ({ toEmail, otp }) => {
    await transporter.sendMailWithRetry({
        from: config.fromEmail,
        to: toEmail,
        subject: "LeapMentor — Reset your password",
        html: buildPasswordResetHtml(otp),
    });
};

module.exports = { sendVerificationOtpEmail, sendPasswordResetOtpEmail };