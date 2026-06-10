// controllers/session.controller.js
const sessionService = require("../services/session.service");
const { logger } = require("@sentry/node");
const AppError = require("../utils/AppError");
const { handleError } = require("../utils/AppError");
// ─────────────────────────────────────────────────────────────
// GET /api/sessions/:connectRequestId/slots
// ─────────────────────────────────────────────────────────────
const getSlots = async (req, res) => {
  try {
    const data = await sessionService.getSlots(
      req.params.connectRequestId,
      req.user._id
    );
    logger.info("getSlots completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in session.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "session.getSlots");
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
    logger.info("setMeetingLink completed successfully");
    return res.json({ success: true, message: "Meeting link updated", ...data });
  } catch (err) {
    logger.error("Unhandled error in session.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "session.setMeetingLink");
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
    logger.info("markSlotComplete completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in session.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "session.markSlotComplete");
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
    logger.info("addSlot completed successfully");
    return res.status(201).json({
      success: true,
      message: "Additional session slot added successfully",
      ...data,
    });
  } catch (err) {
    logger.error("Unhandled error in session.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "session.addSlot");
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
    logger.info("cancelSlot completed successfully");
    return res.json({ success: true, message: "Slot cancelled successfully", ...data });
  } catch (err) {
    logger.error("Unhandled error in session.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "session.cancelSlot");
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
    logger.info("rescheduleSlot completed successfully");
    return res.json({ success: true, message: "Slot rescheduled successfully", ...data });
  } catch (err) {
    logger.error("Unhandled error in session.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "session.rescheduleSlot");
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
    logger.info("getMentorAvailability completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in session.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "session.getMentorAvailability");
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