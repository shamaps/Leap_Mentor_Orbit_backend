const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const goalSchema = new mongoose.Schema(
  {
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      required: true,
      unique: true, // one goal per session
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },
    startDate: {
      type: String, // "YYYY-MM-DD" — consistent with your slot date format
      default: null,
    },
    endDate: {
      type: String, // "YYYY-MM-DD"
      default: null,
    },
    status: {
      type: String,
      enum: ["active", "completed", "abandoned"],
      default: "active",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  BASE_SCHEMA_OPTIONS
);

goalSchema.index({ mentor: 1 });
goalSchema.index({ mentee: 1 });

module.exports = mongoose.model("Goal", goalSchema);