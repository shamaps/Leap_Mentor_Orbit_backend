const reportService = require("../services/report.service");
const { ok, fail } = require("../utils/response"); 
const { handleError } = require("../utils/appError");
const logger = require("../utils/logger");
const submitReport = async (req, res) => {
  try {
    const { connectRequestId, complaintType, description } = req.body;
    const {  body } = await reportService.submitReport({
      connectRequestId,
      complaintType,
      description,
      reportedById: req.user._id,
      file: req.file,
      user: req.user,
    });
    return ok(res, body);
  } catch (err) {
    logger.error("❌ submitReport error:", err);
    return fail(res, "Server error. Please try again.", 500);
  }
};

const getMyReport = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const {  body } = await reportService.getMyReport({
      connectRequestId,
      userId: req.user._id,
    });
    return ok(res, body);
  } catch (err) {
    logger.error("❌ getMyReport error:", err);
    return fail(res, "Server error.", 500);
  }
};

const getAllReports = async (req, res) => {
  try {
    const { status: filterStatus, page, limit } = req.query;
    const { body } = await reportService.getAllReports({
      status: filterStatus,
      page,
      limit,
    });
    return ok(res, body);
  } catch (err) {
    logger.error("❌ getAllReports error:", err);
    return fail(res, "Server error.", 500);
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status: newStatus, adminNote } = req.body;
    const {  body } = await reportService.updateReportStatus({
      reportId,
      status: newStatus,
      adminNote,
      userId: req.user._id,
    });
    return ok(res, body);
  } catch (err) {
    logger.error("❌ updateReportStatus error:", err);
    return fail(res, "Server error.", 500);
  }
};

module.exports = {
  submitReport,
  getMyReport,
  getAllReports,
  updateReportStatus,
};