// backend/models/Wallet.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");
const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one wallet per user
    },

    balance: {
      type: Number,
      default: 0,
      min: 0, // can never go negative
    },

    escrow: {
      type: Number,
      default: 0,
      min: 0, // points held, not yet released to mentor
    },
  },
  BASE_SCHEMA_OPTIONS
);

module.exports = mongoose.model("Wallet", walletSchema);