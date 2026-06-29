// controllers/register.controller.js
const { handleError } = require("../utils/appError");
const { created } = require("../utils/response");

/**
 * @typedef {Object} RegisterService
 * @property {(res: import('express').Response, body: Object) => Promise<Object>} register - Core service logic parsing registration metrics.
 */

/**
 * Factory assembling presentation controller handlers processing incoming user registration payloads for HTTP routing.
 * * @param {RegisterService} registerService - Core onboarding service execution orchestration worker instance.
 * @param {{ logger: Logger }} dependencies - Application performance metric capture monitoring tool.
 * @returns {Object} Grouped controller routes callback actions mapping container.
 */
const createRegisterController = (registerService, { logger }) => {
  /**
   * Express Route handler validating inputs, saving user models, provisioning wallets, and rendering created envelopes.
   * Passes the network response pipe forward to enable low-level security cookie placement loops.
   * * @async
   * @function register
   * @param {import('express').Request} req - Frame parsing context containing registration properties body parameters.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket.
   */
  const register = async (req, res) => {
    try {
      // res is passed through because issueTokens sets a cookie on it
      const data = await registerService.register(res, req.body);
      logger.info("register completed successfully");
      return created(res, data);
    } catch (err) {
      return handleError(res, err, "register.register");
    }
  };

  return { register };
};

module.exports = createRegisterController;