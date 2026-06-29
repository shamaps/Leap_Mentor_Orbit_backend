// controllers/changePassword.controller.js
const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");
/**
 * @typedef {Object} ChangePasswordService
 * @property {(userId: string, current: string, next: string) => Promise<Object>} changePassword
 */

/**
 * Factory function to construct change password presentation controllers for HTTP routing.
 * * @param {ChangePasswordService} changePasswordService - Core service business logic wrapper instance.
 * @param {{ logger: Logger }} dependencies - Application log monitoring tools dependency injection block.
 * @returns {Object} object bundle map containing request controller handles.
 */
const createChangePasswordController = (changePasswordService, { logger }) => {

  /**
   * Express Route handler capturing inbound fields to patch active user password credentials.
   * * @async
   * @function changePassword
   * @param {import('express').Request & { user: { _id: string } }} req - Express request pipe injected with user session identifiers.
   * @param {import('express').Response} res - Standard Express response channel.
   */
  const changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const data = await changePasswordService.changePassword(
        req.user._id,
        currentPassword,
        newPassword
      );
      logger.info("changePassword completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "changePassword.changePassword");
    }
  };

  return { changePassword };
};

module.exports = createChangePasswordController;