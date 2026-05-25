// backend/controllers/login.controller.js
const AppError = require("../utils/AppError");
const loginService = require("../services/login.service");
const { issueTokens,sanitizeUser } = require("../utils/auth.utils");

const login = async (req, res) => {
  try {
    const result = await loginService.login(req.body.email, req.body.password);
    // result = { token (old 7d jwt), user }

    // Replace old token with cookie-based pair
    const accessToken = await issueTokens(res, result.user._id);

    return res.json({
      message: "Login successful",
      accessToken,           // ← was "token", now "accessToken" (15min)
      user: sanitizeUser(result.user), 
    });
  } catch (err) {
    if (err instanceof AppError) {
      const body = { message: err.message };
      // Pass through extra fields set on the unverified-email error
      if (err.isEmailVerified !== undefined) body.isEmailVerified = err.isEmailVerified;
      if (err.email) body.email = err.email;
      return res.status(err.status).json(body);
    }
    return res.status(500).json({ message: err.message });
  }
};

module.exports = { login };