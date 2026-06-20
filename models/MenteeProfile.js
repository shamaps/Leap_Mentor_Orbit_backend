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

    yearsOfExperience: {
  type:    String,
  trim:    true,
  default: "",
},

    bio: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: "",
    },

    profilePicture: {
      type: String, // URL or base64
      default: "",
    },
    profilePictureThumbnail: {   
      type: String,
      default: "",
    },
    profilePicture56: {
      type: String,
      default: ""
    },  // 56×56  avatar
    profilePicture80: {
      type: String,
      default: ""
    },  // 80×80  card
    profilePicture160: {
      type: String,
      default: ""
    },  // 160×160 modal

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
module.exports = mongoose.model("MenteeProfile", menteeProfileSchema);