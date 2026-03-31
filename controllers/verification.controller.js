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
const sendVerificationEmail = async (user, subjectSuffix = "") => {
console.log[EMAIL] Preparing verification email for: ${user.email});
await VerificationToken.deleteMany({ user: user._id });
console.log[EMAIL] Cleared old tokens for user: ${user._id});
const expiresAt = new Date(Date.now() + 10 60 1000);
const otpPlain = makeOtp();
const tokenPlain = makeLinkToken();
const [otpHash, tokenHash] = await Promise.all([
bcrypt.hash(otpPlain, 10),
bcrypt.hash(tokenPlain, 10),
]);
console.log[EMAIL] OTP and token hashed successfully for: ${user.email});
await VerificationToken.create({ user: user._id, otp: otpHash, token: tokenHash, expiresAt });
console.log[EMAIL] Verification token saved to DB. Expires at: ${expiresAt});
const base = process.env.APP_BASE_URL || "http://localhost:5173";
const magicLink = ${base}/verify-email?token=${tokenPlain}&email=${encodeURIComponent(user.email)};
console.log[EMAIL] Magic link generated: ${magicLink});
try {
const info = await transporter.sendMail({
from: process.env.FROM_EMAIL,
to: user.email,
subject: LeapMentor Email Verification${subjectSuffix},
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
console.log[EMAIL] ✅ Email sent successfully to: ${user.email} | MessageId: ${info.messageId});
} catch (mailErr) {
console.error[EMAIL] ❌ Failed to send email to: ${user.email} | Error: ${mailErr.message});
throw mailErr;
}
};
exports.sendVerification = async (req, res) => {
console.log[VERIFY] sendVerification called | body: ${JSON.stringify(req.body)});
try {
const { email } = req.body;
if (!email) {
console.warn[VERIFY] ❌ Missing email in request body);
return res.status(400).json({ message: "email is required" });
}
const user = await User.findOne({ email: String(email).toLowerCase().trim() });
if (!user) {
console.warn[VERIFY] ❌ User not found for email: ${email});
return res.status(404).json({ message: "User not found" });
}
if (user.isEmailVerified) {
console.warn[VERIFY] ❌ Email already verified for: ${email});
return res.status(400).json({ message: "Email is already verified" });
}
console.log[VERIFY] User found: ${user._id} | Sending verification email...);
await sendVerificationEmail(user);
console.log[VERIFY] ✅ sendVerification complete for: ${email});
return res.json({ message: "Verification email sent (OTP + magic link)" });
} catch (err) {
console.error[VERIFY] ❌ sendVerification error: ${err.message});
return res.status(500).json({ message: err.message });
}
};
exports.resendVerification = async (req, res) => {
console.log[RESEND] resendVerification called | body: ${JSON.stringify(req.body)});
try {
const { email } = req.body;
if (!email) {
console.warn[RESEND] ❌ Missing email in request body);
return res.status(400).json({ message: "email is required" });
}
const user = await User.findOne({ email: String(email).toLowerCase().trim() });
if (!user) {
console.warn[RESEND] ❌ User not found for email: ${email});
return res.status(404).json({ message: "User not found" });
}
if (user.isEmailVerified) {
console.warn[RESEND] ❌ Email already verified for: ${email});
return res.status(400).json({ message: "Email is already verified" });
}
console.log[RESEND] Resending verification email to: ${email});
await sendVerificationEmail(user, " (Resend)");
console.log[RESEND] ✅ resendVerification complete for: ${email});
return res.json({ message: "Verification email resent (OTP + magic link)" });
} catch (err) {
console.error[RESEND] ❌ resendVerification error: ${err.message});
return res.status(500).json({ message: err.message });
}
};
exports.verifyOtp = async (req, res) => {
console.log[OTP] verifyOtp called | email: ${req.body?.email});
try {
const { email, otp } = req.body;
if (!email || !otp) {
console.warn[OTP] ❌ Missing email or otp);
return res.status(400).json({ message: "email and otp are required" });
}
const user = await User.findOne({ email: String(email).toLowerCase().trim() });
if (!user) {
console.warn[OTP] ❌ User not found for email: ${email});
return res.status(404).json({ message: "User not found" });
}
const record = await VerificationToken.findOne({ user: user._id });
if (!record) {
console.warn[OTP] ❌ No verification token found for user: ${user._id});
return res.status(400).json({ message: "No verification request found" });
}
if (record.expiresAt < new Date()) {
console.warn[OTP] ❌ Token expired for user: ${user._id} | Expired at: ${record.expiresAt});
await VerificationToken.deleteMany({ user: user._id });
return res.status(400).json({ message: "OTP expired. Please resend." });
}
const ok = await bcrypt.compare(String(otp).trim(), record.otp);
if (!ok) {
console.warn[OTP] ❌ Invalid OTP attempt for user: ${user._id});
return res.status(400).json({ message: "Invalid OTP" });
}
user.isEmailVerified = true;
await user.save();
await VerificationToken.deleteMany({ user: user._id });
console.log[OTP] ✅ Email verified successfully for: ${email});
return res.json({ message: "Email verified successfully" });
} catch (err) {
console.error[OTP] ❌ verifyOtp error: ${err.message});
return res.status(500).json({ message: err.message });
}
};
exports.verifyLink = async (req, res) => {
console.log[LINK] verifyLink called | email: ${req.query?.email});
try {
const { token } = req.params;
const { email } = req.query;
if (!token || !email) {
console.warn[LINK] ❌ Missing token or email);
return res.status(400).json({ message: "token and email are required" });
}
const user = await User.findOne({ email: String(email).toLowerCase().trim() });
if (!user) {
console.warn[LINK] ❌ User not found for email: ${email});
return res.status(404).json({ message: "User not found" });
}
const record = await VerificationToken.findOne({ user: user._id });
if (!record) {
console.warn[LINK] ❌ No verification token found for user: ${user._id});
return res.status(400).json({ message: "No verification request found" });
}
if (record.expiresAt < new Date()) {
console.warn[LINK] ❌ Token expired for user: ${user._id} | Expired at: ${record.expiresAt});
await VerificationToken.deleteMany({ user: user._id });
return res.status(400).json({ message: "Link expired. Please resend." });
}
const ok = await bcrypt.compare(String(token).trim(), record.token);
if (!ok) {
console.warn[LINK] ❌ Invalid token for user: ${user._id});
return res.status(400).json({ message: "Invalid verification token" });
}
user.isEmailVerified = true;
await user.save();
await VerificationToken.deleteMany({ user: user._id });
console.log[LINK] ✅ Email verified via magic link for: ${email});
return res.json({ message: "Email verified successfully" });
} catch (err) {
console.error[LINK] ❌ verifyLink error: ${err.message});
return res.status(500).json({ message: err.message });
}
};
