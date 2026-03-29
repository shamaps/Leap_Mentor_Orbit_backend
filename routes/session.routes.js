// backend/routes/session.routes.js
const express = require("express");
const router  = express.Router();
const { authenticate } = require("../middleware/authenticate");
const {
  getSlots,
  setMeetingLink,
  markSlotComplete,
  addSlot,
  cancelSlot,
  rescheduleSlot,
  getMentorAvailability,
} = require("../controllers/session.controller");

// GET  /api/sessions/:connectRequestId/slots
router.get("/:connectRequestId/slots", authenticate, getSlots);

// GET  /api/sessions/:connectRequestId/mentor-availability
router.get("/:connectRequestId/mentor-availability", authenticate, getMentorAvailability);

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/meeting-link
router.patch("/:connectRequestId/slots/:slotIndex/meeting-link", authenticate, setMeetingLink);

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/mark-complete
router.patch("/:connectRequestId/slots/:slotIndex/mark-complete", authenticate, markSlotComplete);

// POST /api/sessions/:connectRequestId/add-slot
router.post("/:connectRequestId/add-slot", authenticate, addSlot);

// ✅ NEW — PATCH /api/sessions/:connectRequestId/slots/:slotIndex/cancel
router.patch("/:connectRequestId/slots/:slotIndex/cancel", authenticate, cancelSlot);

// ✅ NEW — PATCH /api/sessions/:connectRequestId/slots/:slotIndex/reschedule
router.patch("/:connectRequestId/slots/:slotIndex/reschedule", authenticate, rescheduleSlot);

module.exports = router;