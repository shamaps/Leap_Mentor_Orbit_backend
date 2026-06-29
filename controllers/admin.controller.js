/**
 * @fileoverview Admin controller handling incoming HTTP requests and responses.
 */

const AppError = require("../utils/appError");
const { handleError } = require("../utils/appError");

const { ok, fail, noContent } = require("../utils/response");

/**
 * Creates the admin controller.
 * @param {Object} adminService - The admin service instance.
 * @param {Object} options - Options object.
 * @param {Object} options.logger - Logger instance.
 * @returns {Object} Controller middleware functions.
 */
const createAdminController = (adminService, { logger }) => {
  // AUTH

  /**
   * Handles admin login.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   */
  const adminLogin = async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password)
        return fail(res, "Email and password are required.", 400);

      const result = await adminService.loginAdmin(res, email, password);
      logger.info("adminLogin completed successfully");
      return ok(res, result);
    } catch (err) {
      return handleError(res, err, "adminLogin");
    }
  };

  /**
   * Handles admin logout by clearing the authentication cookie.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   */
  const adminLogout = (req, res) => {
    res.clearCookie("adminAccessToken", { path: "/" });
    logger.info("adminLogout completed successfully");
    return ok(res, { message: "Logged out successfully" });
  };

  /**
   * Returns the currently authenticated admin's data.
   * @param {Object} _req - Express request object.
   * @param {Object} res - Express response object.
   */
  const adminMe = (_req, res) =>
    ok(res, { admin: res.req.admin });

  // STATS

  /**
   * Retrieves top-level aggregate dashboard statistics.
   * @param {Object} _req - Express request object.
   * @param {Object} res - Express response object.
   */
  const getStats = async (_req, res) => {
    try {
      const data = await adminService.fetchStats();
      logger.info("getStats completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getStats");
    }
  };

  /**
   * Retrieves user growth statistics over the past 90 days.
   * @param {Object} _req - Express request object.
   * @param {Object} res - Express response object.
   */
  const getUserGrowth = async (_req, res) => {
    try {
      const data = await adminService.fetchUserGrowth();
      logger.info("getUserGrowth completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getUserGrowth");
    }
  };

  /**
   * Retrieves industry distribution statistics for mentors.
   * @param {Object} _req - Express request object.
   * @param {Object} res - Express response object.
   */
  const getMentorIndustryStats = async (_req, res) => {
    try {
      const data = await adminService.fetchMentorIndustryStats();
      logger.info("getMentorIndustryStats completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getMentorIndustryStats");
    }
  };

  // USER MANAGEMENT

  /**
   * Retrieves a paginated list of users.
   * @param {Object} req - Express request object (includes query parameters).
   * @param {Object} res - Express response object.
   */
  const getUsers = async (req, res) => {
    try {
      const data = await adminService.fetchUsers(req.query);
      logger.info("getUsers completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getUsers");
    }
  };

  /**
   * Retrieves detailed information for a specific user.
   * @param {Object} req - Express request object (includes params.userId).
   * @param {Object} res - Express response object.
   */
  const getUserDetail = async (req, res) => {
    try {
      const data = await adminService.fetchUserDetail(req.params.userId);
      logger.info("getUserDetail completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getUserDetail");
    }
  };

  /**
   * Hard deletes a user permanently.
   * @param {Object} req - Express request object (includes params.userId).
   * @param {Object} res - Express response object.
   */
  const deleteUser = async (req, res) => {
    try {
      await adminService.removeUser(req.params.userId);
      logger.info("deleteUser completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "deleteUser");
    }
  };

  /**
   * Blocks a user (soft delete).
   * @param {Object} req - Express request object (includes params.userId).
   * @param {Object} res - Express response object.
   */
  const blockUser = async (req, res) => {
    try {
      const data = await adminService.blockUser(req.params.userId);
      logger.info("blockUser completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "blockUser");
    }
  };

  /**
   * Unblocks a previously blocked user.
   * @param {Object} req - Express request object (includes params.userId).
   * @param {Object} res - Express response object.
   */
  const unblockUser = async (req, res) => {
    try {
      const data = await adminService.unblockUser(req.params.userId);
      logger.info("unblockUser completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "unblockUser");
    }
  };

  // ENGAGEMENTS

  /**
   * Retrieves overall engagement statistics.
   * @param {Object} _req - Express request object.
   * @param {Object} res - Express response object.
   */
  const getEngagementStats = async (_req, res) => {
    try {
      const data = await adminService.fetchEngagementStats();
      logger.info("getEngagementStats completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getEngagementStats");
    }
  };

  /**
   * Retrieves a paginated list of engagements based on query filters.
   * @param {Object} req - Express request object (includes query parameters).
   * @param {Object} res - Express response object.
   */
  const getEngagements = async (req, res) => {
    try {
      const data = await adminService.fetchEngagements(req.query);
      logger.info("getEngagements completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getEngagements");
    }
  };

  return {
    adminLogin, adminLogout, adminMe, getStats, getUserGrowth,
    getMentorIndustryStats, getUsers, getUserDetail, deleteUser,
    blockUser, unblockUser, getEngagementStats, getEngagements,
  };
};
module.exports = createAdminController;