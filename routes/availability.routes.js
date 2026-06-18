// routes/availability.routes.js
const express = require("express");
const router = express.Router();
const { availabilityController } = require("../config/container");
const {
  getMyAvailability, createAvailability, updateAvailability,
  getMentorAvailability, deleteAvailability, getAvailableSlots,
} = availabilityController;

const { authenticate } = require("../middleware/authenticate");

// ✅ Mentor's own availability (protected)
router.get("/me", authenticate, getMyAvailability);
router.post("/", authenticate, createAvailability);
router.patch("/me", authenticate, updateAvailability);
router.delete("/me", authenticate, deleteAvailability);
router.get("/:mentorId/slots", authenticate, getAvailableSlots);

// ✅ Public — mentee views mentor's available slots for booking
router.get("/:mentorId", getMentorAvailability);

module.exports = router;