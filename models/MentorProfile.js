// models/MentorProfile.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS, applySoftDelete } = require("../utils/baseSchema");

const documentSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const mentorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },

    // ✅ Core Identity
    currentRole: {
      type: String,
      trim: true,
      default: "",
    },

    industry: {
      type: String,
      trim: true,
      default: "",
    },

    company: {
      type: String,
      trim: true,
      default: "",
    },

    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    profilePicture: {
      type: String,
      default: "",
    },

    yearsOfExperience: {
      type: Number,
      min: 0,
      max: 60,
      default: 0,
    },

    hourlyRate: {
      type: Number,
      min: 0,
      default: 0,
    },

    avgRating: {
      type: Number,
      min: 0,
      max: 5,
      default: 0,
    },

    totalSessions: {
      type: Number,
      default: 0,
      min: 0,
    },

    skills: {
      type: [String],
      default: [],
    },

    communicationPreferences: {
      type: [String],
      enum: ["Chat", "Email", "Video Call", "Phone Call", "In-Person"],
      default: [],
    },

    languages: {
      type: [String],
      default: ["English"],
    },

    linkedInUrl: {
      type: String,
      trim: true,
      default: "",
      match: [/^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/, "Invalid URL format"],
    },

    portfolioUrl: {
      type: String,
      trim: true,
      default: "",
      match: [/^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/, "Invalid URL format"],
    },

    isProfileComplete: {
      type: Boolean,
      default: false,
    },

    isProfilePublished: {
      type: Boolean,
      default: false,
    },

    emailNotifications: {
      type: Boolean,
      default: true,
    },

    // ✅ Verification
    // ✅ Verification
    verificationStatus: {
      type: String,
      enum: ["unverified", "verified","pending"],
      default: "unverified",
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: "",
      match: [/^\+?[\d\s\-().]{7,20}$/, "Invalid phone number format"],
    },

    resumeDocument: {
      type: documentSchema,
      default: null,
    },

    workExperienceDocuments: {
      type: [documentSchema],
      default: [],
    },
  },
  BASE_SCHEMA_OPTIONS
);
applySoftDelete(mentorProfileSchema);

module.exports = mongoose.model("MentorProfile", mentorProfileSchema);