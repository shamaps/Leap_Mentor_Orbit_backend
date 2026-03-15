// backend/models/AdminUser.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");

const adminUserSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: true,
      trim:     true,
    },

    email: {
      type:      String,
      required:  true,
      unique:    true,
      lowercase: true,
      trim:      true,
    },

    password: {
      type:     String,
      required: true,
    },

    isSuperAdmin: {
      type:    Boolean,
      default: false, // future: super admin can add/remove other admins
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    lastLoginAt: {
      type:    Date,
      default: null,
    },
  },
  { timestamps: true }
);

// ── Hash password before save ─────────────────────────────────
adminUserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

// ── Compare password ──────────────────────────────────────────
adminUserSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model("AdminUser", adminUserSchema);