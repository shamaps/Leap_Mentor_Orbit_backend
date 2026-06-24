// backend/models/SlotLock.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const slotLockSchema = new mongoose.Schema({
  mentorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  lockedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  date: { type: String, required: true, match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"] },
  startTime: { type: String, required: true, match: [/^\d{2}:\d{2}$/, "Time must be HH:MM"] },
  endTime: { type: String, required: true, match: [/^\d{2}:\d{2}$/, "Time must be HH:MM"] },
  expiresAt: {
    type: Date,
    required: true,
    min: [() => new Date(), "Expiry must be in the future"],
  },
}, BASE_SCHEMA_OPTIONS);

// ✅ MongoDB auto-deletes document when expiresAt is reached
slotLockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// ✅ Prevent duplicate locks on same slot by same mentee
slotLockSchema.index(
  { mentorId: 1, date: 1, startTime: 1, endTime: 1, lockedBy: 1 },
  { unique: true }
);

// ✅ Index for fast lookup by mentorId + date
slotLockSchema.index({ mentorId: 1, date: 1 });

module.exports = mongoose.model("SlotLock", slotLockSchema);