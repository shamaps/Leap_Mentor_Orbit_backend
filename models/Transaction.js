// backend/models/Transaction.js
const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: [
        "credit",           // points added to balance (signup bonus, escrow release)
        "debit",            // points deducted from balance (payment hold)
        "escrow_hold",      // points moved from mentee balance → escrow
        "escrow_release",   // points moved from escrow → mentor balance
        "escrow_refund",    // points returned from escrow → mentee (on rejection/cancel)
        "commission_deduct",// platform takes its commission cut from escrow
        "mentor_payout",    // net amount sent to mentor after commission deduction
      ],
      required: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0.01,
    },

    // Reference to the session this transaction is for (optional for signup bonus)
    connectRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      default: null,
    },

    // Human readable description
    description: {
      type: String,
      default: "",
    },

    // Snapshot of balance after this transaction (for audit trail)
    balanceAfter: {
      type: Number,
      required: true,
    },
  },
  { timestamps: true }
);

// ── Indexes for fast lookup ───────────────────────────────────
transactionSchema.index({ user: 1, createdAt: -1 });
transactionSchema.index({ connectRequest: 1 });
transactionSchema.index({ type: 1 }); 
module.exports = mongoose.model("Transaction", transactionSchema);