// controllers/forgotPassword.controller.js
const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");

/**
 * @typedef {Object} ForgotPasswordService
 * @property {(email: string) => Promise<void>} sendForgotPasswordOTP
 * @property {(data: {email: string, otp: string}) => Promise<string>} verifyResetOTP
 * @property {(data: {email: string, otp: string, newPassword: string}) => Promise<void>} resetPassword
 */

/**
 * Factory assembling presentation controller handlers tracking endpoint operations for credentials recovery.
 * * @param {ForgotPasswordService} service - Underlying business processing orchestration worker module.
 * @param {{ logger: Logger }} dependencies - Application performance metric capture monitoring tool.
 * @returns {Object} Express routing callback methods container blueprint mapping.
 */
const createForgotPasswordController = (service, { logger }) => {

  /**
   * Express Route Handler directing initialization tasks to issue validation codes toward user email addresses.
   * Enforces uniform success output messages to prevent tracking exposure vectors.
   * * @async
   * @function sendForgotPasswordOTP
   * @param {import('express').Request} req - Frame parsing context containing transmission body metrics.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline.
   * @param {import('express').NextFunction} next - Gateway forward loop execution link.
   */
  const sendForgotPasswordOTP = async (req, res, next) => {
    try {
      await service.sendForgotPasswordOTP(req.body.email);

      logger.info("sendForgotPasswordOTP completed successfully");
      return ok(res, { message: "If this email exists, an OTP has been sent." });
    } catch (err) {
      return handleError(res, err, "forgotPassword.sendForgotPasswordOTP");
    }
  };

  /**
   * Express Route Handler receiving confirmation sequences to establish verification privileges.
   * * @async
   * @function verifyResetOTP
   * @param {import('express').Request} req - Interaction request frame context holding parameter metrics body.
   * @param {import('express').Response} res - Execution transport return link interface socket.
   * @param {import('express').NextFunction} next - Control stack flow forward navigation hook.
   */
  const verifyResetOTP = async (req, res, next) => {
    try {
      const { email, otp } = req.body;
      const normalizedEmail = await service.verifyResetOTP({ email, otp });

      logger.info("verifyResetOTP completed successfully");
      return ok(res, { message: "OTP verified", email: normalizedEmail });
    } catch (err) {
      return handleError(res, err, "forgotPassword.verifyResetOTP");
    }
  };

  /**
   * Express Route Handler driving password modifications following absolute validation confirmations.
   * * @async
   * @function resetPassword
   * @param {import('express').Request} req - Operational network request context object containing update vectors.
   * @param {import('express').Response} res - Structural payload interface output transport channel.
   * @param {import('express').NextFunction} next - Middleware stack continuation callback router index link.
   */
  const resetPassword = async (req, res, next) => {
    try {
      const { email, otp, newPassword } = req.body;
      await service.resetPassword({ email, otp, newPassword });

      logger.info("resetPassword completed successfully");
      return ok(res, { message: "Password reset successfully. You can now login." });
    } catch (err) {
      return handleError(res, err, "forgotPassword.resetPassword");
    }
  };

  return { sendForgotPasswordOTP, verifyResetOTP, resetPassword };
};

module.exports = createForgotPasswordController;