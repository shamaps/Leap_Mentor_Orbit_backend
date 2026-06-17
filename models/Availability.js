// models/Availability.js
const mongoose = require("mongoose");
const { PLATFORM_TIMEZONE } = require("../config/constants");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");

// ─── Time Slot ────────────────────────────────────────────────
const timeSlotSchema = new mongoose.Schema(
  {
    startTime: { type: String, required: true }, // "HH:MM"
    endTime:   { type: String, required: true }, // "HH:MM"
  },
  { _id: true }
);

// ─── Day Schedule (weekly recurring) ─────────────────────────
const dayScheduleSchema = new mongoose.Schema(
  {
    day: {
      type: String,
      enum: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      required: true,
    },
    isAvailable: { type: Boolean, default: false },
    slots:       { type: [timeSlotSchema], default: [] },
  },
  { _id: false }
);

// ─── Specific Date Schedule (calendar-based) ─────────────────
// e.g. mentor marks Mar 15 available with custom hours
const specificDateSchema = new mongoose.Schema(
  {
    date:  { type: String, required: true }, // "YYYY-MM-DD"
    slots: { type: [timeSlotSchema], default: [] },
  },
  { _id: false }
);

// ─── Availability ─────────────────────────────────────────────
const availabilitySchema = new mongoose.Schema(
  {
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    timezone: {
      type: String,
      default: PLATFORM_TIMEZONE,
      trim: true,
    },

    sessionDurations: {
      type: [Number],
      default: [30, 60],
      validate: {
        validator: (arr) => arr.every((d) => d > 0 && d <= 480),
        message: "Session durations must be between 1 and 480 minutes",
      },
    },

    // EXISTING — weekly recurring schedule
    weeklyHours: {
      type: [dayScheduleSchema],
      default: () => [
        { day: "Monday",    isAvailable: false, slots: [] },
        { day: "Tuesday",   isAvailable: false, slots: [] },
        { day: "Wednesday", isAvailable: false, slots: [] },
        { day: "Thursday",  isAvailable: false, slots: [] },
        { day: "Friday",    isAvailable: false, slots: [] },
        { day: "Saturday",  isAvailable: false, slots: [] },
        { day: "Sunday",    isAvailable: false, slots: [] },
      ],
    },

    // NEW — specific date availability (calendar picker)
    // Takes priority over weeklyHours for the same date
    specificDates: {
      type: [specificDateSchema],
      default: [],
    },

    googleCalendarConnected: { type: Boolean, default: false },

    googleCalendarToken: {
      type: String,
      default: "",
      select: false,
    },
  },
  BASE_SCHEMA_OPTIONS
);

module.exports = mongoose.model("Availability", availabilitySchema);