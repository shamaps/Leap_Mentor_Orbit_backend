// controllers/session.controller.js
const sessionService = require("../services/session.service");

// ─────────────────────────────────────────────────────────────
// Shared error handler — reads statusCode thrown by the service
// ─────────────────────────────────────────────────────────────
const handleError = (res, err) => {
  console.error("❌ session error:", err.message);
  return res.status(err.statusCode || 500).json({ message: err.message });
};

// ─────────────────────────────────────────────────────────────
// GET /api/sessions/:connectRequestId/slots
// ─────────────────────────────────────────────────────────────
const getSlots = async (req, res) => {
  try {
    const data = await sessionService.getSlots(
      req.params.connectRequestId,
      req.user._id
    );
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/meeting-link
// ─────────────────────────────────────────────────────────────
const setMeetingLink = async (req, res) => {
  try {
    const data = await sessionService.setMeetingLink(
      req.params.connectRequestId,
      req.params.slotIndex,
      req.body.meetingLink,
      req.user._id
    );
    return res.json({ success: true, message: "Meeting link updated", ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/mark-complete
// ─────────────────────────────────────────────────────────────
const markSlotComplete = async (req, res) => {
  try {
    const data = await sessionService.markSlotComplete(
      req.params.connectRequestId,
      req.params.slotIndex,
      req.user._id
    );
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/sessions/:connectRequestId/add-slot
// ─────────────────────────────────────────────────────────────
const addSlot = async (req, res) => {
  try {
    const data = await sessionService.addSlot(
      req.params.connectRequestId,
      req.body,
      req.user._id
    );
    return res.status(201).json({
      success: true,
      message: "Additional session slot added successfully",
      ...data,
    });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/cancel
// ─────────────────────────────────────────────────────────────
const cancelSlot = async (req, res) => {
  try {
    const data = await sessionService.cancelSlot(
      req.params.connectRequestId,
      req.params.slotIndex,
      req.user._id,
      req.body.reason
    );
    return res.json({ success: true, message: "Slot cancelled successfully", ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/reschedule
// ─────────────────────────────────────────────────────────────
const rescheduleSlot = async (req, res) => {
  try {
    const data = await sessionService.rescheduleSlot(
      req.params.connectRequestId,
      req.params.slotIndex,
      req.body,
      req.user._id
    );
    return res.json({ success: true, message: "Slot rescheduled successfully", ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/sessions/:connectRequestId/mentor-availability
// ─────────────────────────────────────────────────────────────
const getMentorAvailability = async (req, res) => {
  try {
    const duration = Number.parseInt(req.query.duration) || 60;
    const data = await sessionService.getMentorAvailability(
      req.params.connectRequestId,
      req.user._id,
      duration
    );
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err);
  }
};

module.exports = {
  getSlots,
  setMeetingLink,
  markSlotComplete,
  addSlot,
  cancelSlot,
  rescheduleSlot,
  getMentorAvailability,
};