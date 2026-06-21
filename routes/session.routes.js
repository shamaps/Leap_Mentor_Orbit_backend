// backend/routes/session.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { sessionController } = require("../config/container");
const {
  getSlots, setMeetingLink, markSlotComplete, addSlot,
  cancelSlot, rescheduleSlot, getMentorAvailability,
} = sessionController;

// GET  /api/sessions/:connectRequestId/slots
// Both mentor and mentee can view their session slots
router.get("/:connectRequestId/slots", authenticate, requireRole("mentor", "mentee"), getSlots);

// GET  /api/sessions/:connectRequestId/mentor-availability
// Either party can check availability when rescheduling
router.get("/:connectRequestId/mentor-availability", authenticate, requireRole("mentor", "mentee"), getMentorAvailability);

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/meeting-link
// Either party can set the meeting link
router.patch("/:connectRequestId/slots/:slotIndex/meeting-link", authenticate, requireRole("mentor", "mentee"), setMeetingLink);

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/mark-complete
// Both parties independently mark their side complete
router.patch("/:connectRequestId/slots/:slotIndex/mark-complete", authenticate, requireRole("mentor", "mentee"), markSlotComplete);

// POST /api/sessions/:connectRequestId/slots
// Either party can propose a new slot
router.post("/:connectRequestId/slots", authenticate, requireRole("mentor", "mentee"), addSlot);

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/cancel
// Either party can cancel a slot
router.patch("/:connectRequestId/slots/:slotIndex/cancel", authenticate, requireRole("mentor", "mentee"), cancelSlot);

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/reschedule
// Either party can reschedule a slot
router.patch("/:connectRequestId/slots/:slotIndex/reschedule", authenticate, requireRole("mentor", "mentee"), rescheduleSlot);

module.exports = router;