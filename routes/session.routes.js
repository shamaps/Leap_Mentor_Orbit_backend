// routes/session.routes.js
const express = require("express");
const router = express.Router();
const { authenticate, requireRole } = require("../middleware/authenticate");
const { sessionController } = require("../config/container");
const {
  getSlots, setMeetingLink, markSlotComplete, addSlot,
  cancelSlot, rescheduleSlot, getMentorAvailability,
} = sessionController;

router.get("/:connectRequestId/slots", authenticate, requireRole("mentor", "mentee"), getSlots);

router.get("/:connectRequestId/mentor-availability", authenticate, requireRole("mentor", "mentee"), getMentorAvailability);

router.patch("/:connectRequestId/slots/:slotIndex/meeting-link", authenticate, requireRole("mentor", "mentee"), setMeetingLink);

router.post("/:connectRequestId/slots", authenticate, requireRole("mentor", "mentee"), addSlot);

// BEFORE (three separate verb-action routes):
// router.patch("/:connectRequestId/slots/:slotIndex/mark-complete", ...)
// router.patch("/:connectRequestId/slots/:slotIndex/cancel", ...)
// router.patch("/:connectRequestId/slots/:slotIndex/reschedule", ...)

// AFTER (one noun-based route, action driven by body):
router.patch(
  "/:connectRequestId/slots/:slotIndex/status",
  authenticate,
  requireRole("mentor", "mentee"),
  (req, res, next) => {
    const action = req.body.action;
    if (action === "complete") return markSlotComplete(req, res, next);
    if (action === "cancel") return cancelSlot(req, res, next);
    if (action === "reschedule") return rescheduleSlot(req, res, next);
    return res.status(400).json({ success: false, message: "action must be complete, cancel, or reschedule" });
  }
);

module.exports = router;