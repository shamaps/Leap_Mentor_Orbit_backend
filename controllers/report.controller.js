const { ok} = require("../utils/response"); 
const { handleError } = require("../utils/appError");
const createReportController = (reportService, { logger }) => {
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
    return handleError(res, err, "report.submitReport");
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
    return handleError(res, err, "report.getMyReport");
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
    return handleError(res, err, "report.getAllReports");
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
    return handleError(res, err, "report.updateReportStatus");
  }
};

  return { submitReport, getMyReport, getAllReports, updateReportStatus };
};
module.exports = createReportController;