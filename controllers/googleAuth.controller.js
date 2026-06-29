// controllers/googleAuth.controller.js
const { issueTokens } = require("../utils/auth.utils");
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} GoogleAuthService
 * @property {(body: Object) => Promise<{ user: Object, isNewUser: boolean }>} googleAuth - Orchestrates verification logic for Google token attributes.
 */

/**
 * Factory assembling presentation entry controllers layer handling HTTP routing boundaries.
 * * @param {GoogleAuthService} service - Core single sign-on execution service orchestration worker instance.
 * @param {{ logger: Logger }} dependencies - Performance trace logger framework capturing diagnostics analytics.
 * @returns {Object} Grouped controller routes callback actions mapping container.
 */
const createGoogleAuthController = (service, { logger }) => {
  /**
   * Express Route Handler receiving third-party Google assertions to authenticate sessions, record user states, and issue security tokens.
   * * @async
   * @function googleAuth
   * @param {import('express').Request} req - Inbound transaction request envelope containing request body properties metrics.
   * @param {import('express').Response} res - Dispatched execution result interface transport link pipeline socket channel.
   */
  const googleAuth = async (req, res) => {
    try {
      const { credential, roles, termsAccepted } = req.body;

      const { user, isNewUser } = await service.googleAuth({ credential, roles, termsAccepted });

      const accessToken = await issueTokens(res, user._id);

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