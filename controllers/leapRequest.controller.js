// controllers/leapRequest.controller.js
const leapRequestService = require("../services/leapRequest.service");
const { logger } = require("@sentry/node");
const AppError = require("../utils/AppError");
const { handleError } = require("../utils/AppError");
// ── MENTEE: Check my latest request ──────────────────────────
const getMyRequest = async (req, res) => {
  try {
    const data = await leapRequestService.getMyRequest(req.user._id);
    logger.info("getMyRequest completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in leapRequest.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "leapRequest.getMyRequest");
  }
};

// ── MENTEE: Create a new request ─────────────────────────────
const createRequest = async (req, res) => {
  try {
    const data = await leapRequestService.createRequest(req.user._id);
    logger.info("createRequest completed successfully");
    return res.status(201).json(data);
  } catch (err) {
    logger.error("Unhandled error in leapRequest.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "leapRequest.createRequest");
  }
};

// ── ADMIN: Get all requests ───────────────────────────────────
const getAllRequests = async (req, res) => {
  try {
    const data = await leapRequestService.getAllRequests();
    logger.info("getAllRequests completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in leapRequest.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "leapRequest.getAllRequests");
  }
};

// ── ADMIN: Get pending count (for sidebar badge) ──────────────
const getPendingCount = async (req, res) => {
  try {
    const data = await leapRequestService.getPendingCount();
    logger.info("getPendingCount completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in leapRequest.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "leapRequest.getPendingCount");
  }
};

// ── ADMIN: Approve — add 500 LP ──────────────────────────────
const approveRequest = async (req, res) => {
  try {
    const data = await leapRequestService.approveRequest(req.params.id, req.admin?._id);
    logger.info("approveRequest completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in leapRequest.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "leapRequest.approveRequest");
  }
};

// ── ADMIN: Reject ─────────────────────────────────────────────
const rejectRequest = async (req, res) => {
  try {
    const data = await leapRequestService.rejectRequest(req.params.id, req.admin?._id);
    logger.info("rejectRequest completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in leapRequest.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "leapRequest.rejectRequest");
  }
};

module.exports = {
  getMyRequest,
  createRequest,
  getAllRequests,
  getPendingCount,
  approveRequest,
  rejectRequest,
};