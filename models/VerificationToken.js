const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const verificationTokenSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  token: { type: String, default: null, maxlength: 512 }, // JWT or UUID token
  otp: { type: String, default: null, maxlength: 60 }, // bcrypt hash of the 6-digit OTP

  expiresAt: {
    type: Date,
    required: true
  }

}, BASE_SCHEMA_OPTIONS);

verificationTokenSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.token;
    delete ret.otp;
    delete ret.__v;
    return ret;
  },
});
verificationTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("VerificationToken", verificationTokenSchema);