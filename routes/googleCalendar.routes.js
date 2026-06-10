// routes/googleCalendar.routes.js
const express = require("express");
const router = express.Router();
const {
  getAuthUrl,
  handleCallback,
  disconnect,
  getBusySlots,
  getEvents,
} = require("../controllers/googleCalendar.controller");
const { authenticate: protect } = require("../middleware/authenticate");

// Get OAuth URL to open in popup
router.get("/auth-url",   protect, getAuthUrl);

// Google redirects here after consent — no auth middleware (Google calls this)
router.get("/callback",   handleCallback);

// Disconnect Google Calendar
router.delete("/connection", protect, disconnect);

// Fetch busy windows for a date range (used by slot busy badge)
router.get("/busy",       protect, getBusySlots);

// Fetch event names for a date range (used by calendar grid tooltip)
router.get("/events",     protect, getEvents);

module.exports = router;