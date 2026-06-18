// backend/controllers/admin/adminReports.controller.js
const { ok, fail, noContent } = require("../../utils/response");
const { handleError } = require("../../utils/appError");
const createAdminReportsController = (adminReportsService, { logger }) => {

// GET /api/admin/reports/stats

const getReportStats = async (_req, res) => {
  try {
    const data = await adminReportsService.fetchReportStats();
    logger.info("getReportStats completed successfully");
    return ok(res, data);
  } catch (err) {
    logger.error("Unhandled error in adminReports.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getReportStats");
  }
};


// GET /api/admin/reports

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
    logger.error("Unhandled error in adminReports.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getReports");
  }
};


// PATCH /api/admin/reports/:id

const handleReport = async (req, res) => {
  try {
    const { status, adminNote } = req.body;

    if (!["resolved", "dismissed"].includes(status)) {
      return fail(res, "Status must be resolved or dismissed.", 422);
    }

    const report = await adminReportsService.handleReport(
      req.params.id,
      { status, adminNote },
      req.admin._id,
    );

    logger.info("handleReport completed successfully");
    return ok(res, { message: `Report ${status}.`, report });
  } catch (err) {
    logger.error("Unhandled error in adminReports.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "handleReport");
  }
};


// POST /api/admin/reports/:id/refund

const processRefund = async (req, res) => {
  try {
    const { refundAmount } = await adminReportsService.processRefund(
      req.params.id,
      req.body,
      req.admin._id,
    );

    logger.info("processRefund completed successfully");
    return ok(res, {
      message: `Refund of ${refundAmount} tokens processed successfully.`,
      refundAmount,
    });
  } catch (err) {
    logger.error("Unhandled error in adminReports.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "processRefund");
  }
};


// DELETE /api/admin/reports/:id/session

const deleteSession = async (req, res) => {
  try {
    await adminReportsService.deleteSession(
      req.params.id,
      req.body,
      req.admin._id,
    );

    logger.info("deleteSession completed successfully");
    return noContent(res);
  } catch (err) {
    logger.error("Unhandled error in adminReports.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "deleteSession");
  }
};

  return { getReportStats, getReports, handleReport, processRefund, deleteSession };
};
module.exports = createAdminReportsController;