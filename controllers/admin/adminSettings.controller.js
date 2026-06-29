// controllers/admin/adminSettings.controller.js
const { ok, created } = require("../../utils/response");
const { handleError } = require("../../utils/appError");

/**
 * @typedef {Object} AdminSettingsService
 * @property {() => Promise<Object>} getOverview
 * @property {(adminId: string, current: string, next: string) => Promise<Object>} changePassword
 * @property {(name: string, email: string) => Promise<Object>} addAdmin
 * @property {(adminId: string) => Promise<Object>} getCommission
 * @property {(adminId: string, rate: number) => Promise<Object>} updateCommission
 */

/**
 * Factory function to assemble Express route handlers.
 * * @param {AdminSettingsService} adminSettingsService - Service layer execution wrapper instance.
 * @param {{ logger: Logger }} dependencies - Global dependencies containing system logger.
 * @returns {Object} Express route operational controllers handler bundle object.
 */
const createAdminSettingsController = (adminSettingsService, { logger }) => {

  /**
   * Express Route handler for rendering total counts.
   * * @async
   * @function getOverview
   * @param {import('express').Request} req - Standard Express inbound message request object.
   * @param {import('express').Response} res - Outbound transmission socket response pipeline wrapper.
   */
  const getOverview = async (req, res) => {
    try {
      const data = await adminSettingsService.getOverview();
      logger.info("getOverview completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "adminSettings.getOverview");
    }
  };

  /**
   * Express Route handler modifying password strings safely.
   * * @async
   * @function changePassword
   * @param {import('express').Request & { admin: { _id: string } }} req - Express request injected with session metadata by authenticators.
   * @param {import('express').Response} res - Standard response channel handler.
   */
  const changePassword = async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const data = await adminSettingsService.changePassword(
        req.admin._id,
        currentPassword,
        newPassword
      );
      logger.info("changePassword completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "adminSettings.changePassword");
    }
  };

  /**
   * Express Route handler provisioning standard administrators dynamically.
   * * @async
   * @function addAdmin
   * @param {import('express').Request} req - Express data payload wrapper context.
   * @param {import('express').Response} res - Return dispatch controller pipeline hook.
   */
  const addAdmin = async (req, res) => {
    try {
      const { name, email } = req.body;
      const data = await adminSettingsService.addAdmin(name, email);
      logger.info("addAdmin completed successfully");
      return created(res, data);
    } catch (err) {
      return handleError(res, err, "adminSettings.addAdmin");
    }
  };

  /**
   * Express Route handler isolating unique rate criteria per active credentials.
   * * @async
   * @function getCommission
   * @param {import('express').Request & { admin: { _id: string } }} req - Route context state container.
   * @param {import('express').Response} res - Response interface layer wrapper.
   */
  const getCommission = async (req, res) => {
    try {
      const data = await adminSettingsService.getCommission(req.admin._id);
      logger.info("getCommission completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "adminSettings.getCommission");
    }
  };

  /**
   * Express Route handler enforcing adjustment to numerical calculations metrics.
   * * @async
   * @function updateCommission
   * @param {import('express').Request & { admin: { _id: string } }} req - Inbound network processing block context.
   * @param {import('express').Response} res - Complete network process cycle closer instance wrapper.
   */
  const updateCommission = async (req, res) => {
    try {
      const data = await adminSettingsService.updateCommission(
        req.admin._id,
        req.body.commissionRate
      );
      logger.info("updateCommission completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "adminSettings.updateCommission");
    }
  };

  return { getOverview, changePassword, addAdmin, getCommission, updateCommission };
};

module.exports = createAdminSettingsController;