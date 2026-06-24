// models/MenteeProfile.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS, applySoftDelete } = require("../utils/baseSchema");

const menteeProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per mentee
    },

    currentRole: { 
      type: String,
       trim: true, 
      default: "",
       maxlength: [100, "Role cannot exceed 100 characters"] },
    industry: 
    { type: String, 
      trim: true,
       default: "",
        maxlength: [100, "Industry cannot exceed 100 characters"] },
    company: { 
      type: String, 
      trim: true,
       default: "", 
       maxlength: [100, "Company cannot exceed 100 characters"] },

    yearsOfExperience: {
      type: String,
      min: 0,
      max: 60,
      default: 0,
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

    skills: {
      type: [String],
      default: [],
    },

    interestedFields: {
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
    marketingPreferences: {
      type: Boolean,
      default: false,
    },
  },
  BASE_SCHEMA_OPTIONS
);
applySoftDelete(menteeProfileSchema);
menteeProfileSchema.index({ interestedFields: 1 });
menteeProfileSchema.index({ skills: 1 });
module.exports = mongoose.model("MenteeProfile", menteeProfileSchema);