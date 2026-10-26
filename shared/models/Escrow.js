const mongoose = require("mongoose");
const { BASE_SCHEMA_OPTIONS } = require("../utils/baseSchema");

const operationSchema = new mongoose.Schema({
  key: { type: String, required: true },
  kind: { type: String, enum: ["hold", "release", "refund"], required: true },
  fingerprint: { type: String, default: null },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  completedAt: { type: Date, default: Date.now },
}, { _id: false });

const refundSchema = new mongoose.Schema({
  slotIndex: { type: Number, min: 0, required: true },
  amount: { type: Number, min: 0, required: true },
  key: { type: String, required: true },
  cancelledBy: { type: String, default: "system" },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
  completedAt: { type: Date, default: Date.now },
}, { _id: false });

const slotSchema = new mongoose.Schema({
  slotIndex: { type: Number, min: 0, required: true },
  slotId: { type: mongoose.Schema.Types.ObjectId, default: null },
  totalAmount: { type: Number, min: 0, required: true },
  commissionAmount: { type: Number, min: 0, required: true },
  mentorPayout: { type: Number, min: 0, required: true },
  status: { type: String, enum: ["held", "refunded", "released"], default: "held", required: true },
}, { _id: false });

const escrowSchema = new mongoose.Schema({
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: "ConnectRequest", required: true, unique: true },
  mentee: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  mentor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sessionRate: { type: Number, required: true, min: 0 },
  sessionCount: { type: Number, required: true, min: 1 },
  totalAmount: { type: Number, required: true, min: 0 },
  commissionRate: { type: Number, required: true, min: 0 },
  commissionAmount: { type: Number, required: true, min: 0 },
  mentorPayout: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["held", "partially_refunded", "released", "refunded"], required: true, default: "held", index: true },
  heldAt: { type: Date, default: Date.now },
  releasedAt: { type: Date, default: null },
  operations: { type: [operationSchema], default: [] },
  refunds: { type: [refundSchema], default: [] },
  slots: { type: [slotSchema], default: [] },
}, BASE_SCHEMA_OPTIONS);

escrowSchema.index({ "refunds.slotIndex": 1, requestId: 1 });

module.exports = mongoose.model("Escrow", escrowSchema);
