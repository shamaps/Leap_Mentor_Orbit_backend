// controllers/auth/google.controller.js
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const OAuthAccount = require("../models/OAuthAccount");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { googleClient, signToken, sanitizeUser, validateRoles } = require("../utils/auth.utils");

const googleAuth = async (req, res) => {
  try {
    const { credential, roles, termsAccepted } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Missing Google credential" });
    }

    const decodedToken = jwt.decode(credential);
    const tokenAudience = decodedToken?.aud;
    const envAudience = process.env.GOOGLE_CLIENT_ID?.trim();

    console.log("DEBUG: Token Audience (aud):", tokenAudience);
    console.log("DEBUG: Env Client ID:", envAudience);

    if (!envAudience) {
      return res.status(500).json({ message: "GOOGLE_CLIENT_ID is undefined in .env" });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: [envAudience, tokenAudience],
    });

    const payload = ticket.getPayload();

    if (payload.aud !== envAudience) {
      console.warn("⚠️ WARNING: Token was issued for a different Client ID. Check your .env!");
    }

    const email = payload?.email?.toLowerCase()?.trim();
    const name = payload?.name || "User";
    const googleSub = payload?.sub;
    const emailVerified = payload?.email_verified;

    if (!email || !googleSub) {
      return res.status(400).json({ message: "Invalid Google payload (missing email/sub)" });
    }

    let user = await User.findOne({ email });
    let isNewUser = false;

    if (!user) {
      if (termsAccepted !== true) {
        return res.status(400).json({ message: "You must accept terms to continue" });
      }

      const incomingRoles = Array.isArray(roles) && roles.length ? roles : ["mentee"];
      const { valid, message, uniqueRoles } = validateRoles(incomingRoles);
      if (!valid) return res.status(400).json({ message });

      user = await User.create({
        name,
        email,
        roles: uniqueRoles,
        isEmailVerified: !!emailVerified,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
      });

      // ✅ Create wallet — 500 points for mentee, 0 for mentor
      const isMentee = uniqueRoles.includes("mentee");
      const startingBalance = isMentee ? 500 : 0;

      await Wallet.create({
        user: user._id,
        balance: startingBalance,
        escrow: 0,
      });

      if (isMentee) {
        await Transaction.create({
          user: user._id,
          type: "credit",
          amount: 500,
          description: "Welcome bonus — 500 points to get started",
          balanceAfter: 500,
        });
      }

      isNewUser = true;

    } else {
      if (Array.isArray(roles) && roles.length) {
        const mergedRoles = [...new Set([...user.roles, ...roles])];
        if (mergedRoles.length !== user.roles.length) {
          user.roles = mergedRoles;
          await user.save();
        }
      }
    }

    const existingOAuth = await OAuthAccount.findOne({ provider: "google", providerId: googleSub });
    if (!existingOAuth) {
      await OAuthAccount.create({ user: user._id, provider: "google", providerId: googleSub });
    }

    const token = signToken(user._id);
    return res.json({
      message: "Google login successful",
      token,
      user: sanitizeUser(user),
      isNewUser,
    });

  } catch (err) {
    console.error("FULL ERROR:", err);
    return res.status(401).json({ message: "User Already Exists!", error: err.message });
  }
};

module.exports = { googleAuth };