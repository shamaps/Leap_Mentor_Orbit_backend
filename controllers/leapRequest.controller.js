// controllers/leapRequest.controller.js
const leapRequestService = require("../services/leapRequest.service");

const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

// ── MENTEE: Check my latest request ──────────────────────────
const getMyRequest = async (req, res) => {
  try {
    const data = await leapRequestService.getMyRequest(req.user._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// ── MENTEE: Create a new request ─────────────────────────────
const createRequest = async (req, res) => {
  try {
    const data = await leapRequestService.createRequest(req.user._id);
    return res.status(201).json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// ── ADMIN: Get all requests ───────────────────────────────────
const getAllRequests = async (req, res) => {
  try {
    const data = await leapRequestService.getAllRequests();
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// ── ADMIN: Get pending count (for sidebar badge) ──────────────
const getPendingCount = async (req, res) => {
  try {
    const data = await leapRequestService.getPendingCount();
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// ── ADMIN: Approve — add 500 LP ──────────────────────────────
const approveRequest = async (req, res) => {
  try {
    const data = await leapRequestService.approveRequest(req.params.id, req.admin?._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
  }
};

// ── ADMIN: Reject ─────────────────────────────────────────────
const rejectRequest = async (req, res) => {
  try {
    const data = await leapRequestService.rejectRequest(req.params.id, req.admin?._id);
    return res.json(data);
  } catch (err) {
    return handleError(res, err);
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