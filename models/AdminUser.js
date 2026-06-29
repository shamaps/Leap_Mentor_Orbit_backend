// backend/models/AdminUser.js
const mongoose = require("mongoose");
const bcrypt   = require("bcryptjs");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
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
      default: false,
    },

    isActive: {
      type:    Boolean,
      default: true,
    },

    lastLoginAt: {
      type:    Date,
      default: null,
    },

    // ── Commission & Earnings ─────────────────────────────────
    commissionRate: {
      type:    Number,
      default: 20,   // 20% platform cut — changeable from admin panel later
      min:     0,
      max:     100,
    },

    walletBalance: {
      type:    Number,
      default: 0,    // cumulative platform earnings from commission
      min:     0,
    },
  },
  BASE_SCHEMA_OPTIONS
  
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

adminUserSchema.set("toJSON", {
  transform: (doc, ret) => {
    delete ret.password;
    delete ret.__v;
    return ret;
  }
});
module.exports = mongoose.model("AdminUser", adminUserSchema);