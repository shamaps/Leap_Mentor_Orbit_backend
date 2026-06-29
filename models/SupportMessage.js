const mongoose = require("mongoose");
const { emailValidator } = require("../utils/emailValidator");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");

const supportMessageSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    trim: true,
    match: emailValidator,
  },
  subject: { type: String, required: true, trim: true, maxlength: [200, "Subject cannot exceed 200 characters"] },
  message: { type: String, required: true, trim: true, maxlength: [2000, "Message cannot exceed 2000 characters"] },
  role:    { type: String, enum: ["mentor", "mentee", "user"], default: "user" },
  status:  { type: String, enum: ["open", "resolved"], default: "open" },
}, BASE_SCHEMA_OPTIONS);
supportMessageSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model("SupportMessage", supportMessageSchema);