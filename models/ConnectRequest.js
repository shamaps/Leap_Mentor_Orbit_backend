// backend/models/ConnectRequest.js
const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS ,applySoftDelete} = require("../utils/baseSchema");

// Additional session slot schema — tracks per-slot payment for extra sessions
const additionalSlotSchema = new mongoose.Schema(
  {
day:       { type: String, required: true, maxlength: 9  }, // "Wednesday" = 9 chars
date:      { type: String, required: true, maxlength: 10 }, // "YYYY-MM-DD"
startTime: { type: String, required: true, maxlength: 5  }, // "HH:MM"
endTime:   { type: String, required: true, maxlength: 5  }, // "HH:MM"

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
    day: { type: String, required: true, maxlength: 9 }, // "Wednesday" = 9 chars
    date: { type: String, required: true, maxlength: 10 }, // "YYYY-MM-DD"
    startTime: { type: String, required: true, maxlength: 5 }, // "HH:MM"
    endTime: { type: String, required: true, maxlength: 5 }, // "HH:MM"

    // per-slot session tracking
    meetingLink: { type: String, default: "", maxlength: 2048 }, // URL
    menteeMarked: { type: Boolean, default: false },
    mentorMarked: { type: Boolean, default: false },
    completedAt:  { type: Date,    default: null  },

    // ✅ NEW — cancel fields
    // "booked" is the default active state; "cancelled" hides from progress
    status: {
      type:    String,
      enum:    ["booked", "cancelled"],
      default: "booked",
    },
    cancelledBy: {
      type:    String,
      enum:    ["mentor", "mentee", null],
      default: null,
    },
    cancelledAt:          { type: Date,   default: null },
    cancellationReason: { type: String, default: "", maxlength: 500 },

    // NEW — reschedule fields
    // isRescheduled: true on BOTH the old (cancelled) slot and the new slot
    isRescheduled:        { type: Boolean, default: false },
    // On the new slot: which index was the original slot it replaced
    rescheduledFromIndex: { type: Number,  default: null  },
  },
  { _id: true }
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
    // Array of slots mentee proposed (min 1, max 5 at creation time only)
    selectedSlots: {
      type: [selectedSlotSchema],
      required: true,
      validate: {
        //  FIX: Only enforce the 1–5 limit when the document is NEW.
        // After creation (ongoing session), additional slots are pushed here
        // for session tracking. Blocking .save() at that point breaks
        // meeting links, mark-complete, and pay-additional flows.
        validator: function (arr) {
          if (this.isNew) {
            return arr.length >= 1 && arr.length <= 5;
          }
          // On updates just require at least 1 slot — no upper limit
          return arr.length >= 1;
        },
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

    // Payment / Escrow fields
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
    requestedAt: { type: Date, default: Date.now },
    respondedAt:  { type: Date, default: null },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // ── Commission fields (populated on escrow release) 
    commissionRate: {
      type:    Number,
      default: null,
      min:     0,
      max:     100,
    },  
    commissionAmount: {
      type:    Number,
      default: null,
      min:     0,
    },
    mentorPayout: {
      type:    Number,
      default: null,
      min:     0,
    },

    //Additional Sessions 
    additionalSlots: {
      type: [additionalSlotSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 50,
        message: "Cannot exceed 50 additional slots per session",
      },
    },
  },
  BASE_SCHEMA_OPTIONS
);

//  Indexes

connectRequestSchema.index({ paymentStatus: 1 });
connectRequestSchema.index({ mentee: 1, requestedAt: -1 });
connectRequestSchema.index({ mentee: 1, status: 1, paidAt: -1 });
connectRequestSchema.index({ mentor: 1, status: 1, paidAt: -1 });
// One pending request per mentee-mentor pair at a time
connectRequestSchema.index(
  { mentee: 1, mentor: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  }
);
// Returns true if escrow is currently held (payment made, not yet released)
connectRequestSchema.methods.isPaid = function () {
  return this.escrowStatus === "held";
};

// Returns true if the connect request is in completed status
connectRequestSchema.methods.isCompleted = function () {
  return this.status === "completed";
};

// Returns true if request is still pending and hasn't been responded to
connectRequestSchema.methods.isPending = function () {
  return this.status === "pending";
};
applySoftDelete(connectRequestSchema);
module.exports = mongoose.model("ConnectRequest", connectRequestSchema);