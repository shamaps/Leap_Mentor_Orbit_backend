// backend/models/ConnectRequest.js
const mongoose = require("mongoose");

// Additional session slot schema — tracks per-slot payment for extra sessions
const additionalSlotSchema = new mongoose.Schema(
  {
    day:       { type: String, required: true },
    date:      { type: String, required: true },
    startTime: { type: String, required: true },
    endTime:   { type: String, required: true },

    // per-slot session tracking (mirrors selectedSlotSchema)
    meetingLink:  { type: String,  default: "" },
    menteeMarked: { type: Boolean, default: false },
    mentorMarked: { type: Boolean, default: false },
    completedAt:  { type: Date,    default: null },

    // payment tracking for this individual additional slot
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },
    paidAt:        { type: Date,   default: null },
    sessionRate:   { type: Number, default: null },
    totalAmount:   { type: Number, default: null },
  },
  { _id: true } // _id: true so each slot gets an id for payAdditional lookup
);

// Single slot schema — reused in array
const selectedSlotSchema = new mongoose.Schema(
  {
    day:       { type: String, required: true },
    date:      { type: String, required: true },
    startTime: { type: String, required: true },
    endTime:   { type: String, required: true },

    // per-slot session tracking
    meetingLink:  { type: String,  default: "" },
    menteeMarked: { type: Boolean, default: false },
    mentorMarked: { type: Boolean, default: false },
    completedAt:  { type: Date,    default: null  },
  },
  { _id: false }
);

const connectRequestSchema = new mongoose.Schema(
  {
    mentee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    mentor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    message: {
      type: String,
      maxlength: 500,
      default: "",
    },
    // Array of slots mentee proposed (min 1, max 5)
    selectedSlots: {
      type: [selectedSlotSchema],
      required: true,
      validate: {
        validator: (arr) => arr.length >= 1 && arr.length <= 5,
        message: "Please select between 1 and 5 slots",
      },
    },
    // The one slot mentor confirms on accept
    confirmedSlot: {
      type: selectedSlotSchema,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "referred", "ongoing", "completed"],
      default: "pending",
    },
    // The mentor this request was referred TO
    referredTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // The new ConnectRequest created for the referred mentor
    referredRequestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConnectRequest",
      default: null,
    },
    // The mentor who referred this request
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ── Payment / Escrow fields ───────────────────────────────
    sessionRate: {
      type: Number,
      default: null,
      min: 1,
    },
    sessionCount: {
      type: Number,
      default: null,
      min: 1,
    },
    totalAmount: {
      type: Number,
      default: null,
      min: 1,
    },
    paymentStatus: {
      type: String,
      enum: ["unpaid", "paid", "refunded"],
      default: "unpaid",
    },
    paidAt: {
      type: Date,
      default: null,
    },
    completedAt: {
      type: Date,
      default: null,
    },
    requestedAt:  { type: Date, default: Date.now },
    respondedAt:  { type: Date, default: null },

    // ── Commission fields (populated on escrow release) ───────
    commissionRate: {
      type:    Number,
      default: null, // snapshot of admin's commissionRate at time of release
      min:     0,
      max:     100,
    },
    commissionAmount: {
      type:    Number,
      default: null, // tokens taken by platform
      min:     0,
    },
    mentorPayout: {
      type:    Number,
      default: null, // tokens actually sent to mentor = totalAmount - commissionAmount
      min:     0,
    },

    // ── Additional Sessions ───────────────────────────────────
    // Extra slots added via the shared dashboard after the session is ongoing.
    // Each slot tracks its own escrow payment independently.
    additionalSlots: {
      type:    [additionalSlotSchema],
      default: [],
    },
  },
  { timestamps: true }
);

// ── Indexes ───────────────────────────────────────────────────
connectRequestSchema.index({ mentor: 1, status: 1 });
connectRequestSchema.index({ mentee: 1, status: 1 });
connectRequestSchema.index({ paymentStatus: 1 });

// One pending request per mentee-mentor pair at a time
connectRequestSchema.index(
  { mentee: 1, mentor: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);

module.exports = mongoose.model("ConnectRequest", connectRequestSchema);