const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const supportTicketSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [2000, "Message cannot exceed 2000 characters"],
    },
    category: {
      type: String,
      default: "General",
    },
    status: {
      type: String,
      enum: ["open", "resolved"],
      default: "open",
    },
  },
  BASE_SCHEMA_OPTIONS
);

module.exports = mongoose.model("SupportTicket", supportTicketSchema);