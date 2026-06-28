// models/MenteeProfile.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS, applySoftDelete } = require("../utils/baseSchema");
const { baseProfileFields } = require("../utils/baseProfileSchema");
const menteeProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one profile per mentee
    },
    ...baseProfileFields, 
    // Mentee-only fields
    yearsOfExperience: { type: String, min: 0, max: 60, default: 0 },
    skills: { type: [String], default: [] },
    interestedFields: { type: [String], default: [] },
    marketingPreferences: { type: Boolean, default: false },
  },
  BASE_SCHEMA_OPTIONS
);
applySoftDelete(menteeProfileSchema);
menteeProfileSchema.index({ interestedFields: 1 });
menteeProfileSchema.index({ skills: 1 });
module.exports = mongoose.model("MenteeProfile", menteeProfileSchema);