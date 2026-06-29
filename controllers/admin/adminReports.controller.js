// backend/controllers/admin/adminReports.controller.js
const { ok, fail, noContent, unprocessable } = require("../../utils/response");
const { handleError } = require("../../utils/appError");

/**
 * Creates the admin reports controller.
 * @param {Object} adminReportsService - The admin reports service instance.
 * @param {Object} options - Controller options.
 * @param {Object} options.logger - Logger instance.
 * @returns {Object} Express controller middleware functions.
 */
const createAdminReportsController = (adminReportsService, { logger }) => {

  // GET /api/admin/reports/stats

  /**
   * Retrieves summary statistics of all user reports.
   * @param {Object} _req - Express request object.
   * @param {Object} res - Express response object.
   */
  const getReportStats = async (_req, res) => {
    try {
      const data = await adminReportsService.fetchReportStats();
      logger.info("getReportStats completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getReportStats");
    }
  };


  // GET /api/admin/reports

  /**
   * Retrieves a paginated and optionally filtered list of reports.
   * @param {Object} req - Express request object (includes query parameters).
   * @param {Object} res - Express response object.
   */
  const getReports = async (req, res) => {
    try {
      const page = Math.max(1, Number.parseInt(req.query.page) || 1);
      const limit = Math.min(20, Number.parseInt(req.query.limit) || 10);
      const search = req.query.search?.trim() || "";
      const status = req.query.status?.trim() || "";

      const data = await adminReportsService.fetchReports({ page, limit, search, status });
      logger.info("getReports completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getReports");
    }
  };


  // PATCH /api/admin/reports/:id

  /**
   * Updates the status of a specific report (e.g., resolving or dismissing it).
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   */
  const handleReport = async (req, res) => {
    try {
      const { status, adminNote } = req.body;

      if (!["resolved", "dismissed"].includes(status)) {
        return unprocessable(res, "Status must be resolved or dismissed.");
      }

      const report = await adminReportsService.handleReport({
        reportId: req.params.id,
        status,
        adminNote,
        adminId: req.admin._id,
      });

      logger.info("handleReport completed successfully");
      return ok(res, { message: `Report ${status}.`, report });
    } catch (err) {
      return handleError(res, err, "handleReport");
    }
  };


  // POST /api/admin/reports/:id/refund

  /**
   * Processes a refund back to a mentee's wallet for a reported session.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   */
  const processRefund = async (req, res) => {
    try {
      const { refundAmount } = await adminReportsService.processRefund({
        reportId: req.params.id,
        adminNote: req.body.adminNote,
        adminId: req.admin._id,
      });

      logger.info("processRefund completed successfully");
      return ok(res, {
        message: `Refund of ${refundAmount} tokens processed successfully.`,
        refundAmount,
      });
    } catch (err) {
      return handleError(res, err, "processRefund");
    }
  };


  // DELETE /api/admin/reports/:id/session

  /**
   * Permanently deletes a session (connect request) associated with a report.
   * @param {Object} req - Express request object.
   * @param {Object} res - Express response object.
   */
  const deleteSession = async (req, res) => {
    try {
      await adminReportsService.deleteSession({
        reportId: req.params.id,
        adminNote: req.body?.adminNote,
        adminId: req.admin._id,
      });

      logger.info("deleteSession completed successfully");
      return noContent(res);
    } catch (err) {
      return handleError(res, err, "deleteSession");
    }
  };

  return { getReportStats, getReports, handleReport, processRefund, deleteSession };
};
module.exports = createAdminReportsController;