// optimal/models/Notification.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const { NOTIFICATION_TYPES } = require("../config/notificationTypes");
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [...NOTIFICATION_TYPES],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
    // Idempotency key for notifications created from stream events (see utils/notificationQueue).
    // Left unset for notifications created any other way (cron reminders, older rows).
    eventId: { type: String, trim: true, maxlength: 200 },
    metadata: {
      // flexible field to store extra info per type
      mentorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      menteeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      sessionId: { type: mongoose.Schema.Types.ObjectId },
      requestId: { type: mongoose.Schema.Types.ObjectId, ref: "ConnectRequest" },
      amount: { type: Number },
      rating: { type: Number },
    },
  },
  BASE_SCHEMA_OPTIONS
);
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
// Unique only where eventId is a string, so notifications without one are unaffected.
// This index is the real duplicate guard: Redis redelivery can never insert the same event twice.
notificationSchema.index(
  { eventId: 1 },
  { unique: true, partialFilterExpression: { eventId: { $type: "string" } } }
);
module.exports = mongoose.model("Notification", notificationSchema);