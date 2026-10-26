const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const oauthAccountSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  provider: {
    type: String,
    enum: ["google", "linkedin", "apple"],
    required: true
  },

  providerId: {
    type: String,
    required: true,
    maxlength: 255, // Google sub IDs are ~21 chars; 255 gives headroom for any provider
    trim: true,
  },

}, BASE_SCHEMA_OPTIONS);
oauthAccountSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
// Prevent same provider account being linked twice (to same or different users)
oauthAccountSchema.index({ provider: 1, providerId: 1 }, { unique: true });
// Prevent one user from linking same provider twice (e.g. two Google accounts)
oauthAccountSchema.index({ user: 1, provider: 1 }, { unique: true });

module.exports = mongoose.model("OAuthAccount", oauthAccountSchema);
