// models/MentorProfile.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS, applySoftDelete } = require("../utils/baseSchema");

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

    // Core Identity
    currentRole: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Role cannot exceed 100 characters"],
    },

    industry: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Industry cannot exceed 100 characters"],
    },

    company: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "Company cannot exceed 100 characters"],
    },

    bio: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: function (v) {
          return v === "" || v.length >= 10;
        },
        message: "Bio must be at least 10 characters",
      },
      maxlength: [1000, "Bio cannot exceed 1000 characters"],
    },

    profilePicture: { type: String, default: "", maxlength: 2048 },
    profilePictureThumbnail: { type: String, default: "", maxlength: 2048 },
    profilePicture56: { type: String, default: "", maxlength: 2048 },
    profilePicture80: { type: String, default: "", maxlength: 2048 },
    profilePicture160: { type: String, default: "", maxlength: 2048 },
    profilePictureOriginalName: { type: String, default: "", maxlength: 255 },

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
      validate: {
        validator: (v) => v === "" || /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/.test(v),
        message: "Invalid URL format",
      },
    },

    portfolioUrl: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (v) => v === "" || /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/.test(v),
        message: "Invalid URL format",
      },
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
    verificationStatus: {
      type: String,
      enum: ["unverified", "verified","pending"],
      default: "unverified",
    },

    phoneNumber: {
      type: String,
      trim: true,
      default: "",
      validate: {
        validator: (v) => v === "" || /^\+?[\d\s\-().]{7,20}$/.test(v),
        message: "Invalid phone number format",
      },
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
mentorProfileSchema.index({ skills: 1 });
mentorProfileSchema.index({ industry: 1 });
mentorProfileSchema.index({ verificationStatus: 1 });
mentorProfileSchema.index({ isProfilePublished: 1 });
module.exports = mongoose.model("MentorProfile", mentorProfileSchema);