const mongoose = require("mongoose");

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
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);
// No changes to schema fields — isDeleted and deletedAt are correct ✅

// Replace your pre-find middleware with this:
userSchema.pre(/^find/, function (next) {
  if (typeof next !== "function") return;

  const options = this.getOptions() || {};
  const filter = this.getFilter() || {};

  if (options.ignoreIsDeleted) return next();
  if (filter.isDeleted === true) return next();

  this.where({ isDeleted: { $ne: true } });
  next();
});
userSchema.index({ roles: 1 });
module.exports = mongoose.model("User", userSchema);
