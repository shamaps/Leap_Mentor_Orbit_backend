const AppError = require("../utils/AppError");
const loginService = require("../services/login.service");
const { issueTokens, sanitizeUser } = require("../utils/auth.utils");
const { logger } = require("@sentry/node");

const login = async (req, res) => {
  try {
    const result = await loginService.login(req.body.email, req.body.password);

    const accessToken = await issueTokens(res, result.user._id);

    // ✅ Successful login
    logger.info("User logged in successfully", {
      userId: result.user._id,
      role: result.user.role,
      email: result.user.email,
    });

    logger.info("login completed successfully");
    return res.json({
      message: "Login successful",
      accessToken,
      user: sanitizeUser(result.user),
    });
  } catch (err) {
    if (err instanceof AppError) {
      // ✅ Known errors — warn level
      logger.warn("Login rejected", {
        email: req.body.email,
        reason: err.message,
        status: err.status,
        isEmailVerified: err.isEmailVerified,
      });

      const body = { message: err.message };
      if (err.isEmailVerified !== undefined) body.isEmailVerified = err.isEmailVerified;
      if (err.email) body.email = err.email;
      return res.status(err.status).json(body);
    }

    // ✅ Unexpected errors — error level
    logger.error("Unexpected error during login", {
      email: req.body.email,
      error: err.message,
    });

    return res.status(500).json({ message: err.message });
  }
};

module.exports = { login };