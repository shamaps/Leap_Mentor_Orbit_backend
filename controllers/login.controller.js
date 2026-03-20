const bcrypt = require("bcryptjs");
const User = require("../models/User");
const { signToken, sanitizeUser } = require("../utils/auth.utils");

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "email and password are required" });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    if (!user || !user.password) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    if (!user.isEmailVerified) {
      return res.status(403).json({
        message: "Please verify your email before logging in.",
        isEmailVerified: false,
        email: user.email,
        });
    } 

    const token = signToken(user._id);
    return res.json({
      message: "Login successful",
      token,
      user: sanitizeUser(user),
    });

  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { login };