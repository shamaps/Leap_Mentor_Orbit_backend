// backend/models/Message.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const messageSchema = new mongoose.Schema(
  {
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 5000,
    },
    readAt: {
      type: Date,
      default: null,
    },
  },
  BASE_SCHEMA_OPTIONS
);

// ✅ Compound index for fast paginated queries per session
messageSchema.index({ connectRequest: 1, createdAt: -1 });

// ✅ Index for unread count queries
messageSchema.index({ connectRequest: 1, sender: 1, readAt: 1 });

module.exports = mongoose.model("Message", messageSchema);