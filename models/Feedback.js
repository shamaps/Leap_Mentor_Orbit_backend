// backend/models/Feedback.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS ,applySoftDelete} = require("../utils/baseSchema");

const feedbackSchema = new mongoose.Schema(
  {
    connectRequest: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "ConnectRequest",
      required: true,
    },
    from: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    to: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      "User",
      required: true,
    },
    fromRole: {
      type:     String,
      enum:     ["mentor", "mentee"],
      required: true,
    },
    rating: {
      type:     Number,
      required: true,
      min:      1,
      max:      5,
    },
    comment: {
      type:    String,
      trim:    true,
      maxlength: 1000,
      default: "",
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",   // AdminUser who reviewed/removed this feedback
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    slotIndex: {                   
      type: Number,
      default: undefined,          
    },
  },
  BASE_SCHEMA_OPTIONS
);

// ✅ One feedback per user per session
feedbackSchema.index({ connectRequest: 1, from: 1, slotIndex: 1 }, { unique: true, sparse: true });

// ✅ Fast lookup for all feedback on a session
feedbackSchema.index({ connectRequest: 1 });

// ✅ Fast lookup for all feedback received by a user (for avg rating)
feedbackSchema.index({ to: 1 });
applySoftDelete(feedbackSchema);
module.exports = mongoose.model("Feedback", feedbackSchema);