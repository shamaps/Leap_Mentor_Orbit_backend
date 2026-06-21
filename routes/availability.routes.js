// routes/availability.routes.js
const express = require("express");
const router = express.Router();
const { availabilityController } = require("../config/container");
const {
  getMyAvailability, createAvailability, updateAvailability,
  getMentorAvailability, deleteAvailability, getAvailableSlots,
} = availabilityController;

const { authenticate, requireRole } = require("../middleware/authenticate");

// ✅ Mentor's own availability (mentor only)
router.get("/me", authenticate, requireRole("mentor"), getMyAvailability);
router.post("/", authenticate, requireRole("mentor"), createAvailability);
router.patch("/me", authenticate, requireRole("mentor"), updateAvailability);
router.delete("/me", authenticate, requireRole("mentor"), deleteAvailability);

// ✅ Mentee views a mentor's available slots for booking
router.get("/:mentorId/slots", authenticate, requireRole("mentee"), getAvailableSlots);

// ✅ Public — no auth needed
router.get("/:mentorId", getMentorAvailability);

module.exports = router;