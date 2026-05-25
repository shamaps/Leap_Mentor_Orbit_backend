// controllers/connectRequest.controller.js
const service = require("../services/connectRequest.service");

// ─────────────────────────────────────────────────────────────
// Every controller follows the same pattern:
//   1. Extract params from req
//   2. Call service
//   3. Return response
//   4. catch(next) → global error handler
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/connect-requests
 * Mentee sends a connect request with multiple proposed slots.
 */
const sendConnectRequest = async (req, res, next) => {
  try {
    const { mentorId, message, selectedSlots, sessionRate, sessionCount } = req.body;

    const request = await service.sendRequest({
      mentorId,
      menteeId: req.user._id,
      menteeName: req.user.name,
      message,
      selectedSlots,
      sessionRate,
      sessionCount,
    });

    return res.status(201).json({
      message: "Connect request sent successfully",
      request,
    });
  } catch (err) {
    // Mongoose duplicate key — treat as conflict
    if (err.code === 11000)
      return res.status(409).json({ message: "You already have a pending request with this mentor" });
    next(err);
  }
};

/**
 * GET /api/connect-requests/my-requests
 * Mentee views all their sent requests.
 */
const getMyRequests = async (req, res, next) => {
  try {
    const requests = await service.getMyRequests(req.user._id);
    return res.json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/connect-requests/incoming
 * Mentor views all incoming requests, optionally filtered by status.
 */
const getIncomingRequests = async (req, res, next) => {
  try {
    const requests = await service.getIncomingRequests(req.user._id, req.query.status);
    return res.json({ success: true, requests });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/connect-requests/:id
 * Mentor accepts or rejects a request.
 */
const respondToRequest = async (req, res, next) => {
  try {
    const { status, confirmedSlot } = req.body;

    const request = await service.respondToRequest(
      req.params.id,
      req.user._id,
      status,
      confirmedSlot
    );

    return res.json({ message: `Request ${status} successfully`, request });
  } catch (err) {
    next(err);
  }
};

/**
 * DELETE /api/connect-requests/:id
 * Mentee cancels a pending request.
 */
const cancelRequest = async (req, res, next) => {
  try {
    await service.cancelRequest(req.params.id, req.user._id);
    return res.json({ message: "Request cancelled successfully" });
  } catch (err) {
    next(err);
  }
};

/**
 * PATCH /api/connect-requests/:id/refer
 * Mentor refers a request to another mentor.
 */
const referRequest = async (req, res, next) => {
  try {
    const { originalRequest, newRequest } = await service.referRequest(
      req.params.id,
      req.user._id,
      req.body.referToMentorId
    );

    return res.json({
      message: "Request referred successfully",
      originalRequest,
      newRequest,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/connect-requests/ongoing
 * Returns ongoing + completed sessions for the logged-in user.
 */
const getOngoingConnects = async (req, res, next) => {
  try {
    const connects = await service.getOngoingConnects(req.user._id);
    return res.json({ success: true, connects });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/connect-requests/:id/detail
 * Full detail of a single connect request with both profiles.
 */
const getConnectDetail = async (req, res, next) => {
  try {
    const connect = await service.getConnectDetail(req.params.id, req.user._id);
    return res.json({ success: true, connect });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  sendConnectRequest,
  getMyRequests,
  getIncomingRequests,
  respondToRequest,
  cancelRequest,
  referRequest,
  getOngoingConnects,
  getConnectDetail,
};