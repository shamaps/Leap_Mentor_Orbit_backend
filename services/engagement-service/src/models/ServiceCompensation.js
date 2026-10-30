const mongoose = require("mongoose");

const serviceCompensationSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    action: { type: String, required: true, enum: ["payments.release", "payments.slotRefund", "catalog.slotRelease", "catalog.confirmSlot", "catalog.mentorRating", "session.cancelSlot", "session.rescheduleSlot", "session.confirmBooking"] },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: {
    type: String, enum: ["pending", "processing", "completed", "failed"], default: "pending", index: true },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now, index: true },
    leaseUntil: { type: Date, default: null },
    lastError: { type: String, default: "" },
    result: { type: mongoose.Schema.Types.Mixed, default: null },
    completedAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
}, { timestamps: true, minimize: false });

serviceCompensationSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });

module.exports = mongoose.models.ServiceCompensation || mongoose.model("ServiceCompensation", serviceCompensationSchema);
