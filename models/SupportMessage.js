const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
  },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  role:    { type: String, enum: ["mentor", "mentee", "user"], default: "user" },
  status:  { type: String, enum: ["open", "resolved"], default: "open" },
}, { timestamps: true });

module.exports = mongoose.model("SupportMessage", supportMessageSchema);