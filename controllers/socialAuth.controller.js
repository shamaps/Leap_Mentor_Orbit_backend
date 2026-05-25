// controllers/socialAuth.controller.js
const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");
const { issueTokens, sanitizeUser, validateRoles } = require("../utils/auth.utils"); // ← swap

const socialAuth = async (req, res) => {
  try {
    const { provider, providerId, email, name, roles, termsAccepted } = req.body;

    const allowed = ["linkedin", "apple"];
    if (!allowed.includes(provider))
      return res.status(400).json({ message: "Invalid provider" });
    if (!providerId)
      return res.status(400).json({ message: "providerId is required" });

    const existingOAuth = await OAuthAccount.findOne({ provider, providerId }).populate("user");
    if (existingOAuth?.user) {
      const accessToken = await issueTokens(res, existingOAuth.user._id);  // ← swap
      return res.json({ message: "Social login successful", accessToken, user: sanitizeUser(existingOAuth.user) });
    }

    if (!email)
      return res.status(400).json({ message: "email is required to create/link account" });

    const normalizedEmail = String(email).toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      if (termsAccepted !== true)
        return res.status(400).json({ message: "You must accept terms to continue" });

      const incomingRoles = Array.isArray(roles) && roles.length ? roles : ["mentee"];
      const { valid, message, uniqueRoles } = validateRoles(incomingRoles);
      if (!valid) return res.status(400).json({ message });

      user = await User.create({
        name: name ? String(name).trim() : "User",
        email: normalizedEmail,
        password: undefined,
        roles: uniqueRoles,
        isEmailVerified: true,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      });
    }

    await OAuthAccount.create({ user: user._id, provider, providerId });

    const accessToken = await issueTokens(res, user._id);  // ← swap
    return res.json({ message: "Social login successful", accessToken, user: sanitizeUser(user) });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { socialAuth };