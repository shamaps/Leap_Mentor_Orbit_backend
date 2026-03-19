// backend/models/Report.js
const mongoose = require("mongoose");

const COMPLAINT_TYPES = [
  "vulgar_chat",
  "harassment",
  "other",
];

const reportSchema = new mongoose.Schema(
  {
    // ── References ────────────────────────────────────────────
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

    // ── Reporter context ──────────────────────────────────────
    reporterRole: {
      type: String,
      enum: ["mentor", "mentee"],
      required: true,
    },

    // ── Complaint details ─────────────────────────────────────
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

    // ── Screenshot (Cloudinary) ───────────────────────────────
    screenshotUrl: {
      type: String,
      default: "",
    },

    screenshotPublicId: {
      type: String,
      default: "",
    },

    // ── Admin workflow ────────────────────────────────────────
    status: {
      type: String,
      enum: ["open", "under_review", "resolved", "dismissed"],
      default: "open",
    },

    adminNote: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    resolvedAt: {
      type: Date,
      default: null,
    },

    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
reportSchema.index({ connectRequest: 1 });
reportSchema.index({ reportedBy: 1 });
reportSchema.index({ reportedUser: 1 });
reportSchema.index({ status: 1 });
reportSchema.index({ createdAt: -1 }); // admin dashboard sorted by newest

// ── Prevent duplicate reports by same user for same connect request ──
reportSchema.index(
  { connectRequest: 1, reportedBy: 1 },
  { unique: true }
);

module.exports = mongoose.model("Report", reportSchema);