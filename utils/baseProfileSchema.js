// utils/baseProfileSchema.js
const mongoose = require("mongoose");

// ── Shared URL validator 
const URL_REGEX = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/;
const urlValidator = {
    validator: (v) => v === "" || URL_REGEX.test(v),
    message: "Invalid URL format",
};

// ── Fields shared between MentorProfile and MenteeProfile 
const baseProfileFields = {
    currentRole: {
        type: String, trim: true, default: "",
        maxlength: [100, "Role cannot exceed 100 characters"],
    },
    industry: {
        type: String, trim: true, default: "",
        maxlength: [100, "Industry cannot exceed 100 characters"],
    },
    company: {
        type: String, trim: true, default: "",
        maxlength: [100, "Company cannot exceed 100 characters"],
    },
    bio: {
        type: String, trim: true, default: "",
        validate: {
            validator: (v) => v === "" || v.length >= 10,
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
        type: String, trim: true, default: "",
        validate: urlValidator,
    },
    portfolioUrl: {
        type: String, trim: true, default: "",
        validate: urlValidator,
    },
    communicationPreferences: {
        type: [String],
        enum: ["Chat", "Email", "Video Call", "Phone Call", "In-Person"],
        default: [],
    },
    languages: { type: [String], default: ["English"] },
    isProfileComplete: { type: Boolean, default: false },
    isProfilePublished: { type: Boolean, default: false },
    emailNotifications: { type: Boolean, default: true },
};

module.exports = { baseProfileFields, urlValidator };