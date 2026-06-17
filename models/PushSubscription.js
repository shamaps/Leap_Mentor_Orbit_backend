const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const pushSubscriptionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subscription: {
      endpoint: { type: String, required: true },
      keys: {
        p256dh: { type: String, required: true },
        auth:   { type: String, required: true },
      },
    },
  },
  BASE_SCHEMA_OPTIONS
);

// One subscription per user per endpoint
pushSubscriptionSchema.index({ user: 1, "subscription.endpoint": 1 }, { unique: true });
pushSubscriptionSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.subscription;
    delete ret.__v;
    return ret;
  },
});
module.exports = mongoose.model("PushSubscription", pushSubscriptionSchema);