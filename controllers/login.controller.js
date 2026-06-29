const { handleError } = require("../utils/appError");
const { issueTokens } = require("../utils/auth.utils");
const { ok } = require("../utils/response");

/**
 * @typedef {Object} LoginService
 * @property {(email: string, password: string) => Promise<{user: Object}>} login - Evaluates credential arguments against validation rules.
 */

/**
 * Factory assembling presentation controller handlers processing incoming user credential payloads for HTTP routing.
 * * @param {LoginService} loginService - Core identity authentication execution service orchestration instance.
 * @param {{ logger: Logger }} dependencies - Application performance metric capture monitoring tool.
 * @returns {Object} Grouped controller routes callback actions mapping container.
 */
const createLoginController = (loginService, { logger }) => {

  /**
   * Express Route handler parsing user credentials, executing validations, issuing JWT cookies, and logging outcomes.
   * * @async
   * @function login
   * @param {import('express').Request} req - Frame parsing context containing transmission credentials body parameters.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket.
   */
  const login = async (req, res) => {
    try {
      const result = await loginService.login(req.body.email, req.body.password);

      const accessToken = await issueTokens(res, result.user._id);

      //  Successful login
      logger.info("User logged in successfully", {
        userId: result.user._id,
        role: result.user.role,
        email: result.user.email,
      });

      logger.info("login completed successfully");
      return ok(res, {
        message: "Login successful",
        accessToken,
        user: result.user,
        isNewUser: false
      });
    } catch (err) {
      return handleError(res, err, "login.login");
    }
  };

  return { login };
};

module.exports = createLoginController;