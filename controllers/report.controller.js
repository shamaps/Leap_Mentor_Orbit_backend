const reportService = require("../services/report.service");

const logger = require("../utils/logger");
const submitReport = async (req, res) => {
  try {
    const { connectRequestId, complaintType, description } = req.body;
    const { status, body } = await reportService.submitReport({
      connectRequestId,
      complaintType,
      description,
      reportedById: req.user._id,
      file: req.file,
      user: req.user,
    });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("❌ submitReport error:", err);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
};

const getMyReport = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const { status, body } = await reportService.getMyReport({
      connectRequestId,
      userId: req.user._id,
    });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("❌ getMyReport error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const getAllReports = async (req, res) => {
  try {
    const { status: filterStatus, page, limit } = req.query;
    const { status, body } = await reportService.getAllReports({
      status: filterStatus,
      page,
      limit,
    });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("❌ getAllReports error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

const updateReportStatus = async (req, res) => {
  try {
    const { reportId } = req.params;
    const { status: newStatus, adminNote } = req.body;
    const { status, body } = await reportService.updateReportStatus({
      reportId,
      status: newStatus,
      adminNote,
      userId: req.user._id,
    });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("❌ updateReportStatus error:", err);
    return res.status(500).json({ message: "Server error." });
  }
};

module.exports = {
  submitReport,
  getMyReport,
  getAllReports,
  updateReportStatus,
};