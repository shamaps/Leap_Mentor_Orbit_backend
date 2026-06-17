const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS,applySoftDelete } = require("../utils/baseSchema");
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email format"],
    },

    password: {
      type: String,
    },

    roles: {
      type: [String],
      enum: ["mentor", "mentee"],
      required: true,
      validate: {
        validator: function (val) {
          return val.length === 1;
        },
        message: "A user can only have one role.",
      },
    },

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    termsAccepted: {
      type: Boolean,
      required: true,
    },

    termsAcceptedAt: {
      type: Date,
    },
    passwordChangedAt: {
      type: Date,
      default: null,
    },
  },
  BASE_SCHEMA_OPTIONS,
);
// No changes to schema fields — isDeleted and deletedAt are correct ✅


userSchema.index({ roles: 1 });
userSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.passwordChangedAt;
    delete ret.__v;
    return ret;
  }
});
applySoftDelete(userSchema);
module.exports = mongoose.model("User", userSchema);
