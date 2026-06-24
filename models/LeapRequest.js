const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");

const leapRequestSchema = new mongoose.Schema(
  {
    mentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    currentBalance: {
      type: Number,
      default: 0,
      min: [0, "Balance cannot be negative"],
    },
    reviewedAt: Date,
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdminUser",
    },
  },
    BASE_SCHEMA_OPTIONS
);
leapRequestSchema.index({ mentee: 1 });
leapRequestSchema.index({ status: 1 });
leapRequestSchema.index({ mentee: 1, status: 1 }); 

module.exports = mongoose.model("LeapRequest", leapRequestSchema);