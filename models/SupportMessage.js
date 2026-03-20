const mongoose = require("mongoose");

const supportMessageSchema = new mongoose.Schema({
  email:   { type: String, required: true },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  role:    { type: String, enum: ["mentor", "mentee", "user"], default: "user" },
  status:  { type: String, enum: ["open", "resolved"], default: "open" },
}, { timestamps: true });

module.exports = mongoose.model("SupportMessage", supportMessageSchema);