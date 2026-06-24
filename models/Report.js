// backend/models/Report.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS ,applySoftDelete} = require("../utils/baseSchema");
const COMPLAINT_TYPES = [
  "inappropriate_behavior",
  "session_misconduct",
  "fake_credentials",
  "spam_scam",
  "refund",
  "other",
];

const reportSchema = new mongoose.Schema(
  {
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: true,
    },
    reportedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    reporterRole: {
      type: String,
      enum: ["mentor", "mentee"],
      required: true,
    },
    complaintType: {
      type: String,
      enum: COMPLAINT_TYPES,
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },
    screenshotUrl: { type: String, default: "" },
    screenshotPublicId: { type: String, default: "" },
    screenshotOriginalName: { type: String, default: "" },
    screenshotThumbnailUrl: { type: String, default: "" },
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "dismissed"],
      default: "open",
    },
    adminNote: { type: String, trim: true, maxlength: 2000, default: "" },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    //NEW — track if refund was processed by admin
    refundProcessed: { type: Boolean, default: false },
    refundedAt: { type: Date, default: null },
  },
  BASE_SCHEMA_OPTIONS
);

reportSchema.index({ connectRequest: 1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 });
reportSchema.index({ connectRequest: 1, reportedBy: 1 }, { unique: true });
applySoftDelete(reportSchema);
module.exports = mongoose.model("Report", reportSchema);