// controllers/googleAuth.controller.js
const { issueTokens } = require("../utils/auth.utils");   // ← ADD
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");
const createGoogleAuthController = (service, { logger }) => {
const googleAuth = async (req, res) => {
  try {
    const { credential, roles, termsAccepted } = req.body;

    // Service now returns { user, isNewUser } — no token
    const { user, isNewUser } = await service.googleAuth({ credential, roles, termsAccepted });

    const accessToken = await issueTokens(res, user._id);  // ← ADD

    logger.info("googleAuth completed successfully");
    return ok(res, {
      message: "Google login successful",
      accessToken,   
      user,
      isNewUser,
    });
  } catch (err) {
    return handleError(res, err, "googleAuth.googleAuth");
  }
};

  return { googleAuth };
};
module.exports = createGoogleAuthController;