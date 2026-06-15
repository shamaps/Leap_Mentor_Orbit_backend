// controllers/clerkSSO.controller.js
const AppError = require("../utils/AppError");
const clerkSSOService = require("../services/clerkSSO.service");
const logger = require("../utils/logger");
const { issueTokens } = require("../utils/auth.utils");   // ← ADD

const clerkSSO = async (req, res) => {
  try {
    // Service must return { user } — remove signToken from clerkSSO.service.js too
    const result = await clerkSSOService.clerkSSO(req.body);

    const accessToken = await issueTokens(res, result.user._id);  // ← ADD

    logger.info("clerkSSO completed successfully");
    return res.json({
      message: "SSO login successful",
      accessToken,    // ← was spread from result which had "token"
      user: result.user,
    });
  } catch (err) {
    if (err instanceof AppError)
      return res.status(err.status).json({ message: err.message });
    logger.error("❌ Clerk SSO error:", err);
    return res.status(401).json({ message: "Clerk SSO authentication failed", error: err.message });
  }
};

module.exports = { clerkSSO };