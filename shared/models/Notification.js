// optimal/models/Notification.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "connect_request_received",
        "connect_request_accepted",
        "connect_request_declined",
        "upcoming_session",
        "new_message",
        "session_completed",
        "new_review",
        "support_resolved",
      ],
      required: true,
    },
    title: { type: String, required: true, maxlength: 200 },
    message: { type: String, required: true, maxlength: 1000 },
    read: { type: Boolean, default: false },
    metadata: {
      // flexible field to store extra info per type
      mentorId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      menteeId:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      sessionId:  { type: mongoose.Schema.Types.ObjectId },
      requestId:  { type: mongoose.Schema.Types.ObjectId, ref: "ConnectRequest" },
      amount:     { type: Number },
      rating:     { type: Number },
    },
  },
  BASE_SCHEMA_OPTIONS
);
notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });
module.exports = mongoose.model("Notification", notificationSchema);