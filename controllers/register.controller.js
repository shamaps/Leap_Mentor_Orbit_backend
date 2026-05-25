// controllers/register.controller.js
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Wallet = require("../models/Wallet");
const Transaction = require("../models/Transaction");
const { issueTokens, sanitizeUser, validateRoles } = require("../utils/auth.utils"); // ← swap signToken → issueTokens

const register = async (req, res) => {
  try {
    const { name, email, password, roles, termsAccepted } = req.body;

    if (!roles || roles.length !== 1)
      return res.status(400).json({ message: "Exactly one role is required." });
    if (!name || !email || !password)
      return res.status(400).json({ message: "name, email, password are required" });
    if (!Array.isArray(roles) || roles.length === 0)
      return res.status(400).json({ message: "roles must be an array with at least one role" });
    if (termsAccepted !== true)
      return res.status(400).json({ message: "You must accept terms to continue" });

    const normalizedEmail = String(email).toLowerCase().trim();
    const { valid, message, uniqueRoles } = validateRoles(roles);
    if (!valid) return res.status(400).json({ message });

    const existing = await User.findOne({ email: normalizedEmail });

    if (existing) {
      const newRoles = [...new Set([...existing.roles, ...uniqueRoles])];
      const rolesChanged = newRoles.length !== existing.roles.length;

      if (rolesChanged) {
        existing.roles = newRoles;
        await existing.save();

        const addedRoles = uniqueRoles.filter(r => !existing.roles.includes(r));
        for (const role of addedRoles) {
          const existingWallet = await Wallet.findOne({ user: existing._id, role });
          if (!existingWallet) {
            const isMentee = role === "mentee";
            const wallet = await Wallet.create({ user: existing._id, role, balance: isMentee ? 500 : 0, escrow: 0 });
            console.log(`Wallet created for existing user — role: ${role}`, wallet);
            if (isMentee) {
              await Transaction.create({ user: existing._id, type: "credit", amount: 500, description: "Welcome bonus — 500 points to get started", balanceAfter: 500 });
            }
          }
        }
      }

      // ← REMOVED stray signToken call that was here doing nothing
      return res.status(400).json({ message: "This email is already registered. Please login instead." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      email: normalizedEmail,
      password: hashed,
      roles: uniqueRoles,
      isEmailVerified: false,
      termsAccepted: true,
      termsAcceptedAt: new Date(),
    });

    for (const role of uniqueRoles) {
      const isMentee = role === "mentee";
      const wallet = await Wallet.create({ user: user._id, role, balance: isMentee ? 500 : 0, escrow: 0 });
      console.log(`Wallet created — role: ${role}`, wallet);
      if (isMentee) {
        await Transaction.create({ user: user._id, type: "credit", amount: 500, description: "Welcome bonus — 500 points to get started", balanceAfter: 500 });
      }
    }

    // ← was: const token = signToken(user._id); return res.json({ token, ... })
    const accessToken = await issueTokens(res, user._id);
    return res.status(201).json({
      message: "Registered successfully",
      accessToken,
      user: sanitizeUser(user),
      isNewUser: true,
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { register };