// controllers/session.controller.js
const sessionService = require("../services/session.service");
const logger = require("../utils/logger");
const AppError = require("../utils/appError");
const { handleError } = require("../utils/appError");
const { ok, created } = require("../utils/response"); 
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
    return ok(res, data);
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
    const data = await sessionService.setMeetingLink({  // ← was positional, now object
      connectRequestId: req.params.connectRequestId,
      slotIndex: req.params.slotIndex,
      meetingLink: req.body.meetingLink,
      userId: req.user._id,
    });
    logger.info("setMeetingLink completed successfully");
    return ok(res, { message: "Meeting link updated", ...data });
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
    return ok(res, data);
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
    return created(res, {
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
    const data = await sessionService.cancelSlot({  // ← was positional, now object
      connectRequestId: req.params.connectRequestId,
      slotIndex: req.params.slotIndex,
      userId: req.user._id,
      reason: req.body.reason,
    });
    logger.info("cancelSlot completed successfully");
    return ok(res, { message: "Slot cancelled successfully", ...data });
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
    const data = await sessionService.rescheduleSlot({  // ← was positional, now object
      connectRequestId: req.params.connectRequestId,
      slotIndex: req.params.slotIndex,
      body: req.body,
      userId: req.user._id,
    });
    logger.info("rescheduleSlot completed successfully");
    return ok(res, { message: "Slot rescheduled successfully", ...data });
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
    return ok(res, data);
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