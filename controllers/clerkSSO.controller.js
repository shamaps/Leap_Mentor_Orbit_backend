// controllers/clerkSSO.controller.js
const { handleError } = require("../utils/appError");
const { issueTokens } = require("../utils/auth.utils");
const { ok } = require("../utils/response");

/**
 * @typedef {Object} ClerkSSOService
 * @property {(body: Object) => Promise<{ user: Object, isNewUser: boolean }>} clerkSSO - Processing workflow verifying clerk parameters.
 */

/**
 * Factory assembling presenting layer controller bindings for network route routers.
 * * @param {ClerkSSOService} clerkSSOService - Configured worker instance executing identification business constraints.
 * @param {{ logger: Logger }} dependencies - Logging metrics trace block parameter elements.
 * @returns {Object} Bundle containing endpoint context router action triggers.
 */
const createClerkSSOController = (clerkSSOService, { logger }) => {

  /**
   * Express Route Handler receiving frontend token assertions to authorize sessions, issue tracking JWTs, and return user models.
   * * @async
   * @function clerkSSO
   * @param {import('express').Request} req - Inbound interaction parameter context structure wrapper holding token credentials body.
   * @param {import('express').Response} res - Response transport interface layer closing communication tracking pipeline loops.
   */
  const clerkSSO = async (req, res) => {
    try {
      const result = await clerkSSOService.clerkSSO(req.body);

      const accessToken = await issueTokens(res, result.user._id);

      logger.info("clerkSSO completed successfully");
      return ok(res, {
        message: "SSO login successful",
        accessToken,
        user: result.user,
      });
    } catch (err) {
      return handleError(res, err, "clerkSSO.clerkSSO");
    }
  };

  return { clerkSSO };
};

module.exports = createClerkSSOController;