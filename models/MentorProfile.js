// models/MentorProfile.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS, applySoftDelete } = require("../utils/baseSchema");
const { baseProfileFields } = require("../utils/baseProfileSchema");
const documentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true, maxlength: 2048 },
    publicId: { type: String, required: true, maxlength: 255 },
    originalName: { type: String, default: "", maxlength: 255 },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true }
);

const mentorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    ...baseProfileFields,  
    // Mentor-only fields
    yearsOfExperience: { type: Number, min: 0, max: 60, default: 0 },
    hourlyRate: { type: Number, min: 0, default: 0 },
    avgRating: { type: Number, min: 0, max: 5, default: 0 },
    totalSessions: { type: Number, default: 0, min: 0 },
    skills: { type: [String], default: [] },
    verificationStatus: {
      type: String,
      enum: ["unverified", "verified", "pending"],
      default: "unverified",
    },
    phoneNumber: {
      type: String, trim: true, default: "",
      validate: {
        validator: (v) => v === "" || /^\+?[\d\s\-().]{7,20}$/.test(v),
        message: "Invalid phone number format",
      },
    },
    resumeDocument: { type: documentSchema, default: null },
    workExperienceDocuments: {
      type: [documentSchema], default: [],
      validate: { validator: (arr) => arr.length <= 10, message: "Cannot upload more than 10 work experience documents" },
    },
  },
  BASE_SCHEMA_OPTIONS
);
applySoftDelete(mentorProfileSchema);
mentorProfileSchema.index({ skills: 1 });
mentorProfileSchema.index({ industry: 1 });
mentorProfileSchema.index({ verificationStatus: 1 });
mentorProfileSchema.index({ isProfilePublished: 1, isProfileComplete: 1, avgRating: -1 });
module.exports = mongoose.model("MentorProfile", mentorProfileSchema);