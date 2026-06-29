// controllers/report.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} ReportService
 * @property {(params: Object) => Promise<{ status: number, body: Object }>} submitReport - Registers a user report payload containing optional media.
 * @property {(params: Object) => Promise<{ status: number, body: Object }>} getMyReport - Pulls a single reporter complaint entry.
 * @property {(params: Object) => Promise<{ status: number, body: Object }>} getAllReports - Compiles a list of moderation items.
 * @property {(params: Object) => Promise<{ status: number, body: Object }>} updateReportStatus - Updates a report's lifecycle state indicators.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} info - Logs routine service path completions successfully.
 * @property {(message: string, error: any) => void} error - Traces lower-level application execution exceptions.
 */

/**
 * Factory implementing presentation layer endpoints handling system moderation report payloads.
 * * @param {ReportService} reportService - Core underlying moderation service orchestration layer worker.
 * @param {{ logger: Logger }} dependencies - Application core telemetry logging infrastructure tools.
 * @returns {Object} Grouped controller endpoints route callback actions map configuration.
 */
const createReportController = (reportService, { logger }) => {

  /**
   * Express Route Handler receiving text properties and file buffers to log a user complaint.
   * * @async
   * @function submitReport
   * @param {import('express').Request & { file?: Object }} req - Inbound network request context containing body and screenshot attachments.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket channel.
   */
  const submitReport = async (req, res) => {
    try {
      const { connectRequestId, complaintType, description } = req.body;
      const { body } = await reportService.submitReport({
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

  /**
   * Express Route Handler reading path selectors to return a reporter's individual filed complaint.
   * * @async
   * @function getMyReport
   * @param {import('express').Request} req - Route context parameter request object containing route parameters.
   * @param {import('express').Response} res - Standard output response transport connection pipe closure socket.
   */
  const getMyReport = async (req, res) => {
    try {
      const { connectRequestId } = req.params;
      const { body } = await reportService.getMyReport({
        connectRequestId,
        userId: req.user._id,
      });
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "report.getMyReport");
    }
  };

  /**
   * Express Route Handler compiling paginated overviews tracking submitted user complaint documents.
   * * @async
   * @function getAllReports
   * @param {import('express').Request} req - Operational network context object parsing filter query arguments.
   * @param {import('express').Response} res - Structural payload interface output return connector.
   */
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

  /**
   * Express Route Handler directing administrative inputs to overwrite or resolve complaint lifecycle variables.
   * * @async
   * @function updateReportStatus
   * @param {import('express').Request} req - Dynamic framework input request container mapping path keys and state data.
   * @param {import('express').Response} res - Dispatched update outcome transport adapter pipeline closure.
   */
  const updateReportStatus = async (req, res) => {
    try {
      const { reportId } = req.params;
      const { status: newStatus, adminNote } = req.body;
      const { body } = await reportService.updateReportStatus({
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