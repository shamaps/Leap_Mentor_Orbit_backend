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
    required: true
  }

}, BASE_SCHEMA_OPTIONS);
oauthAccountSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});
module.exports = mongoose.model("OAuthAccount", oauthAccountSchema);
