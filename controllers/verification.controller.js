const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const makeOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const makeLinkToken = () => crypto.randomBytes(32).toString("hex");

/**
 * Generates OTP + magic link, saves BOTH to DB, sends ONE email with both options.
 */
const sendVerificationEmail = async (user, subjectSuffix = "") => {
  await VerificationToken.deleteMany({ user: user._id });

  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  const otpPlain = makeOtp();
  const tokenPlain = makeLinkToken();

  const [otpHash, tokenHash] = await Promise.all([
    bcrypt.hash(otpPlain, 10),
    bcrypt.hash(tokenPlain, 10),
  ]);

  await VerificationToken.create({ user: user._id, otp: otpHash, token: tokenHash, expiresAt });

  const base = process.env.APP_BASE_URL || "http://localhost:5173";
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

exports.sendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email is already verified" });

    await sendVerificationEmail(user);
    return res.json({ message: "Verification email sent (OTP + magic link)" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "email is required" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "User not found" });
    if (user.isEmailVerified) return res.status(400).json({ message: "Email is already verified" });

    await sendVerificationEmail(user, " (Resend)");
    return res.json({ message: "Verification email resent (OTP + magic link)" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "email and otp are required" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const record = await VerificationToken.findOne({ user: user._id });
    if (!record) return res.status(400).json({ message: "No verification request found" });

    if (record.expiresAt < new Date()) {
      await VerificationToken.deleteMany({ user: user._id });
      return res.status(400).json({ message: "OTP expired. Please resend." });
    }

    const ok = await bcrypt.compare(String(otp).trim(), record.otp);
    if (!ok) return res.status(400).json({ message: "Invalid OTP" });

    user.isEmailVerified = true;
    await user.save();
    await VerificationToken.deleteMany({ user: user._id });
    return res.json({ message: "Email verified successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

exports.verifyLink = async (req, res) => {
  try {
    const { token } = req.params;
    const { email } = req.query;
    if (!token || !email) return res.status(400).json({ message: "token and email are required" });

    const user = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (!user) return res.status(404).json({ message: "User not found" });

    const record = await VerificationToken.findOne({ user: user._id });
    if (!record) return res.status(400).json({ message: "No verification request found" });

    if (record.expiresAt < new Date()) {
      await VerificationToken.deleteMany({ user: user._id });
      return res.status(400).json({ message: "Link expired. Please resend." });
    }

    const ok = await bcrypt.compare(String(token).trim(), record.token);
    if (!ok) return res.status(400).json({ message: "Invalid verification token" });

    user.isEmailVerified = true;
    await user.save();
    await VerificationToken.deleteMany({ user: user._id });
    return res.json({ message: "Email verified successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
