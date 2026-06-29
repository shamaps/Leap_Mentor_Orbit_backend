/**
 * @fileoverview Controller handlers for processing admin billing, revenue, and transaction dashboard metrics.
 * @module controllers/admin/adminPaymentsController
 * @requires utils/appError
 * @requires utils/response
 */

const { handleError } = require("../../utils/appError");
const { ok } = require("../../utils/response");

/**
 * Creates the admin payments controller instance with isolated service dependency injection.
 * * @param {Object} adminPaymentsService - The domain service instance managing system financial calculations.
 * @param {Object} options - Structural framework injection parameters.
 * @param {Object} options.logger - The structured logging framework instance.
 * @returns {Object} Express middleware endpoint handlers for payment administration metrics.
 */
const createAdminPaymentsController = (adminPaymentsService, { logger }) => {

  /**
   * GET /api/admin/payments/stats
   * Retrieves overall payment and revenue statistics for the admin dashboard.
   * * @async
   * @param {import('express').Request} req - Express request object containing verified req.admin context.
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<import('express').Response>} Express JSON response envelope containing aggregated statistics.
   */
  const getPaymentStats = async (req, res) => {
    try {
      const data = await adminPaymentsService.fetchPaymentStats(req.admin._id);
      logger.info("getPaymentStats completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "adminPayments.getPaymentStats");
    }
  };

  /**
   * GET /api/admin/payments/chart
   * Retrieves revenue chart data grouped sequentially by calendar month.
   * * @async
   * @param {import('express').Request} _req - Express request object (omitted context).
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<import('express').Response>} Express JSON response envelope containing 6-month charting metrics.
   */
  const getRevenueChart = async (_req, res) => {
    try {
      const data = await adminPaymentsService.fetchRevenueChart();
      logger.info("getRevenueChart completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "adminPayments.getRevenueChart");
    }
  };

  /**
   * GET /api/admin/payments/transactions
   * Retrieves a paginated list of system transactions with filtering and name search parameters.
   * * @async
   * @param {import('express').Request} req - Express request object containing query constraints (page, limit, search, type).
   * @param {import('express').Response} res - Express response object.
   * @returns {Promise<import('express').Response>} Express JSON response envelope containing rows and pagination metadata.
   */
  const getTransactions = async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page) || 1);
      const limit = Math.min(20, Number.parseInt(req.query.limit) || 10);
      const search = req.query.search?.trim() || "";
      const type = req.query.type?.trim() || "";

      const data = await adminPaymentsService.fetchTransactions({ page, limit, search, type });
      logger.info("getTransactions completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "adminPayments.getTransactions");
    }
  };

  return { getPaymentStats, getRevenueChart, getTransactions };
};

module.exports = createAdminPaymentsController;