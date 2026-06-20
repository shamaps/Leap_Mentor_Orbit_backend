// controllers/clerkSSO.controller.js
const AppError = require("../utils/appError");
const { issueTokens } = require("../utils/auth.utils");   
const { ok, fail } = require("../utils/response");
const createClerkSSOController = (clerkSSOService, { logger }) => {
const clerkSSO = async (req, res) => {
  try {
    // Service must return { user } — remove signToken from clerkSSO.service.js too
    const result = await clerkSSOService.clerkSSO(req.body);

    const accessToken = await issueTokens(res, result.user._id);  

    logger.info("clerkSSO completed successfully");
    return ok(res, {
      message: "SSO login successful",
      accessToken,    // ← was spread from result which had "token"
      user: result.user,
    });
    } catch (err) {
      logger.error("❌ Clerk SSO error:", { error: err.message });
      return handleError(res, err, "clerkSSO");
    }
};

  return { clerkSSO };
};
module.exports = createClerkSSOController;