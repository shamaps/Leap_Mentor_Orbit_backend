// backend/controllers/session.controller.js
const mongoose       = require("mongoose");
const ConnectRequest = require("../models/ConnectRequest");
const Availability   = require("../models/Availability");
const releaseEscrow  = require("../utils/releaseEscrow");
const escrowService  = require("../services/escrow.service"); // ✅ NEW — for slot refunds

// ── Auth helper ───────────────────────────────────────────────
const assertParticipant = (connectRequest, userId) => {
  const uid = userId.toString();
  return (
    connectRequest.mentor.toString() === uid ||
    connectRequest.mentee.toString() === uid
  );
};

// ── Slot index validator ──────────────────────────────────────
const getValidatedSlot = (connectRequest, slotIndex) => {
  const idx = parseInt(slotIndex);
  if (isNaN(idx) || idx < 0 || idx >= connectRequest.selectedSlots.length) {
    return null;
  }
  return { slot: connectRequest.selectedSlots[idx], idx };
};

// ✅ Helper — emit slot update to both participants in real time
const emitSlotUpdate = (connectRequest, payload) => {
  try {
    const { emitToUser } = require("../socket/socketHandler");
    if (!emitToUser) return;
    emitToUser(connectRequest.mentor.toString(), "session_slots_updated", payload);
    emitToUser(connectRequest.mentee.toString(), "session_slots_updated", payload);
  } catch (e) {
    console.warn("⚠️ emitSlotUpdate failed:", e.message);
  }
};

// ✅ Helper — emit targeted event to only one user (the other party)
const emitToOther = (connectRequest, currentUserId, event, payload) => {
  try {
    const { emitToUser } = require("../socket/socketHandler");
    if (!emitToUser) return;
    const otherId =
      connectRequest.mentor.toString() === currentUserId.toString()
        ? connectRequest.mentee.toString()
        : connectRequest.mentor.toString();
    emitToUser(otherId, event, payload);
  } catch (e) {
    console.warn("⚠️ emitToOther failed:", e.message);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/sessions/:connectRequestId/slots
// ─────────────────────────────────────────────────────────────
const getSlots = async (req, res) => {
  try {
    const { connectRequestId } = req.params;

    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .select("mentor mentee selectedSlots additionalSlots status")
      .lean();

    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only count non-cancelled slots for progress
    const activeSlots = connectRequest.selectedSlots.filter(
      (s) => s.status !== "cancelled"
    );
    const completedCount = activeSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    return res.json({
      success: true,
      slots: connectRequest.selectedSlots,
      additionalSlots: connectRequest.additionalSlots || [],
      totalSlots: activeSlots.length,
      completedSlots: completedCount,
      progress: activeSlots.length > 0
        ? Math.round((completedCount / activeSlots.length) * 100)
        : 0,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/meeting-link
// ─────────────────────────────────────────────────────────────
const setMeetingLink = async (req, res) => {
  try {
    const { connectRequestId, slotIndex } = req.params;
    const { meetingLink } = req.body;

    if (!meetingLink?.trim()) {
      return res.status(400).json({ message: "meetingLink is required" });
    }

    const connectRequest = await ConnectRequest.findById(connectRequestId);
    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (connectRequest.status !== "ongoing") {
      return res.status(400).json({ message: "Session is not active" });
    }

    const validated = getValidatedSlot(connectRequest, slotIndex);
    if (!validated) {
      return res.status(400).json({ message: "Invalid slot index" });
    }

    connectRequest.selectedSlots[validated.idx].meetingLink = meetingLink.trim();
    connectRequest.markModified("selectedSlots");
    await connectRequest.save();

    const activeSlots = connectRequest.selectedSlots.filter(
      (s) => s.status !== "cancelled"
    );
    const completedCount = activeSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    const payload = {
      connectRequestId,
      slots:         connectRequest.selectedSlots,
      totalSlots:    activeSlots.length,
      completedSlots: completedCount,
      progress:      activeSlots.length > 0
        ? Math.round((completedCount / activeSlots.length) * 100)
        : 0,
    };

    emitSlotUpdate(connectRequest, payload);

    return res.json({
      success: true,
      message: "Meeting link updated",
      slot: connectRequest.selectedSlots[validated.idx],
      slotIndex: validated.idx,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/mark-complete
// ─────────────────────────────────────────────────────────────
const markSlotComplete = async (req, res) => {
  const mongoSession = await mongoose.startSession();
  mongoSession.startTransaction();

  try {
    const { connectRequestId, slotIndex } = req.params;
    const userId = req.user._id;

    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .session(mongoSession);

    if (!connectRequest) {
      await mongoSession.abortTransaction();
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, userId)) {
      await mongoSession.abortTransaction();
      return res.status(403).json({ message: "Not authorized" });
    }
    if (connectRequest.status !== "ongoing") {
      await mongoSession.abortTransaction();
      return res.status(400).json({ message: "Session is not active" });
    }

    const validated = getValidatedSlot(connectRequest, slotIndex);
    if (!validated) {
      await mongoSession.abortTransaction();
      return res.status(400).json({ message: "Invalid slot index" });
    }

    const { idx } = validated;
    const slot     = connectRequest.selectedSlots[idx];

    // Block marking cancelled slots complete
    if (slot.status === "cancelled") {
      await mongoSession.abortTransaction();
      return res.status(400).json({ message: "Cannot mark a cancelled slot as complete" });
    }

    const isMentor = connectRequest.mentor.toString() === userId.toString();
    const isMentee = connectRequest.mentee.toString() === userId.toString();

    if (slot.menteeMarked && slot.mentorMarked) {
      await mongoSession.abortTransaction();
      return res.status(400).json({ message: "This session is already marked complete by both parties" });
    }

    if (isMentee) {
      if (slot.menteeMarked) {
        await mongoSession.abortTransaction();
        return res.status(400).json({ message: "You have already marked this session complete" });
      }
      connectRequest.selectedSlots[idx].menteeMarked = true;
    }

    if (isMentor) {
      if (slot.mentorMarked) {
        await mongoSession.abortTransaction();
        return res.status(400).json({ message: "You have already marked this session complete" });
      }
      connectRequest.selectedSlots[idx].mentorMarked = true;
    }

    const bothMarked =
      connectRequest.selectedSlots[idx].menteeMarked &&
      connectRequest.selectedSlots[idx].mentorMarked;

    if (bothMarked) {
      connectRequest.selectedSlots[idx].completedAt = new Date();
    }

    connectRequest.markModified("selectedSlots");
    await connectRequest.save({ session: mongoSession });

    // allComplete only counts non-cancelled slots
    const activeSlots = connectRequest.selectedSlots.filter(
      (s) => s.status !== "cancelled"
    );
    const allComplete = activeSlots.length > 0 && activeSlots.every(
      (s) => s.menteeMarked && s.mentorMarked
    );

    let releaseResult = null;
    if (allComplete) {
      releaseResult = await releaseEscrow(connectRequestId, mongoSession);
    }

    await mongoSession.commitTransaction();

    const completedCount = activeSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    const responsePayload = {
      success: true,
      message: allComplete
        ? "All sessions complete! Tokens released to mentor."
        : bothMarked
          ? "Session marked complete by both parties."
          : `Session marked complete. Waiting for ${isMentee ? "mentor" : "mentee"} to confirm.`,
      slot:          connectRequest.selectedSlots[idx],
      slotIndex:     idx,
      bothMarked,
      allComplete,
      completedSlots: completedCount,
      totalSlots:    activeSlots.length,
      progress:      activeSlots.length > 0
        ? Math.round((completedCount / activeSlots.length) * 100)
        : 0,
      escrowRelease: releaseResult,
    };

    emitSlotUpdate(connectRequest, {
      connectRequestId,
      slots:          connectRequest.selectedSlots,
      totalSlots:     activeSlots.length,
      completedSlots: completedCount,
      progress:       responsePayload.progress,
      allComplete,
    });

    return res.json(responsePayload);

  } catch (err) {
    await mongoSession.abortTransaction();
    console.error("❌ markSlotComplete error:", err.message);
    return res.status(500).json({ message: err.message });
  } finally {
    mongoSession.endSession();
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/sessions/:connectRequestId/add-slot
// ─────────────────────────────────────────────────────────────
const addSlot = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    let { day, date, startTime, endTime } = req.body;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: "date, startTime and endTime are required" });
    }

    if (!day) {
      const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
      day = DAYS[new Date(date + "T00:00:00").getDay()];
    }

    const connectRequest = await ConnectRequest.findById(connectRequestId);
    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (connectRequest.status !== "ongoing") {
      return res.status(400).json({ message: "Can only add slots to an ongoing session" });
    }

    const slotTaken =
      connectRequest.selectedSlots.find(
        (s) => s.date === date && s.startTime === startTime && s.endTime === endTime && s.status !== "cancelled"
      ) ||
      connectRequest.additionalSlots?.find(
        (s) => s.date === date && s.startTime === startTime && s.endTime === endTime
      );

    if (slotTaken) {
      return res.status(409).json({ message: "This slot already exists in the session" });
    }

    const newAdditionalSlot = {
      day,
      date,
      startTime,
      endTime,
      meetingLink:   "",
      menteeMarked:  false,
      mentorMarked:  false,
      completedAt:   null,
      paymentStatus: "pending",
    };

    const newSelectedSlot = {
      day,
      date,
      startTime,
      endTime,
      meetingLink:  "",
      menteeMarked: false,
      mentorMarked: false,
      completedAt:  null,
      status:       "booked",
    };

    connectRequest.additionalSlots.push(newAdditionalSlot);
    connectRequest.markModified("additionalSlots");

    connectRequest.selectedSlots.push(newSelectedSlot);
    connectRequest.markModified("selectedSlots");

    await connectRequest.save({ validateBeforeSave: false });

    const savedAdditionalSlot =
      connectRequest.additionalSlots[connectRequest.additionalSlots.length - 1];

    const activeSlots = connectRequest.selectedSlots.filter(
      (s) => s.status !== "cancelled"
    );
    const completedCount = activeSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    const socketPayload = {
      connectRequestId,
      slots:           connectRequest.selectedSlots,
      additionalSlots: connectRequest.additionalSlots,
      totalSlots:      activeSlots.length,
      completedSlots:  completedCount,
      progress:        activeSlots.length > 0
        ? Math.round((completedCount / activeSlots.length) * 100)
        : 0,
    };

    emitSlotUpdate(connectRequest, socketPayload);

    return res.status(201).json({
      success: true,
      message: "Additional session slot added successfully",
      slot:    newAdditionalSlot,
      slotId:  savedAdditionalSlot._id,
      ...socketPayload,
    });
  } catch (err) {
    console.error("❌ addSlot error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ PATCH /api/sessions/:connectRequestId/slots/:slotIndex/cancel
// Both mentor and mentee can cancel a slot.
// Triggers an immediate partial token refund to the mentee.
// ─────────────────────────────────────────────────────────────
const cancelSlot = async (req, res) => {
  try {
    const { connectRequestId, slotIndex } = req.params;
    const { reason = "" } = req.body;
    const userId = req.user._id;

    const connectRequest = await ConnectRequest.findById(connectRequestId);
    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }
    if (connectRequest.status !== "ongoing") {
      return res.status(400).json({ message: "Session is not active" });
    }

    const validated = getValidatedSlot(connectRequest, slotIndex);
    if (!validated) {
      return res.status(400).json({ message: "Invalid slot index" });
    }

    const { idx } = validated;
    const slot = connectRequest.selectedSlots[idx];

    if (slot.status === "cancelled") {
      return res.status(400).json({ message: "This slot is already cancelled" });
    }
    if (slot.menteeMarked && slot.mentorMarked) {
      return res.status(400).json({ message: "Cannot cancel a completed slot" });
    }

    const isMentor  = connectRequest.mentor.toString() === userId.toString();
    const cancelledBy = isMentor ? "mentor" : "mentee";

    // Mark slot as cancelled
    connectRequest.selectedSlots[idx].status             = "cancelled";
    connectRequest.selectedSlots[idx].cancelledBy        = cancelledBy;
    connectRequest.selectedSlots[idx].cancelledAt        = new Date();
    connectRequest.selectedSlots[idx].cancellationReason = reason.trim();

    connectRequest.markModified("selectedSlots");
    await connectRequest.save({ validateBeforeSave: false });

    // ✅ Trigger immediate partial refund to mentee
    // Non-blocking — if refund fails the slot is still cancelled; error is logged
    let refundResult = null;
    try {
      if (connectRequest.paymentStatus === "paid") {
        refundResult = await escrowService.refundSlot({
          connectRequestId,
          slotIndex: idx,
          cancelledBy,
        });
        console.log(
          `✅ Slot #${idx + 1} refund: ${refundResult.refundedAmount} tokens returned to mentee`
        );
      }
    } catch (refundErr) {
      console.error("❌ Slot refund failed (slot still cancelled):", refundErr.message);
    }

    const activeSlots = connectRequest.selectedSlots.filter(
      (s) => s.status !== "cancelled"
    );
    const completedCount = activeSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    const socketPayload = {
      connectRequestId,
      slots:          connectRequest.selectedSlots,
      totalSlots:     activeSlots.length,
      completedSlots: completedCount,
      progress:       activeSlots.length > 0
        ? Math.round((completedCount / activeSlots.length) * 100)
        : 0,
    };

    // Emit full slot update to both parties
    emitSlotUpdate(connectRequest, socketPayload);

    // Notify the OTHER party with a dedicated event (includes refund info)
    emitToOther(connectRequest, userId, "slot_cancelled", {
      connectRequestId,
      slotIndex: idx,
      slot:        connectRequest.selectedSlots[idx],
      cancelledBy,
      reason:      reason.trim(),
      refund:      refundResult
        ? { amount: refundResult.refundedAmount }
        : null,
    });

    return res.json({
      success:   true,
      message:   "Slot cancelled successfully",
      slot:      connectRequest.selectedSlots[idx],
      slotIndex: idx,
      // ✅ Refund details returned so the frontend can show the mentee their new balance
      refund: refundResult
        ? {
            refundedAmount: refundResult.refundedAmount,
            newBalance:     refundResult.balance,
            newEscrow:      refundResult.escrow,
          }
        : null,
      ...socketPayload,
    });
  } catch (err) {
    console.error("❌ cancelSlot error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// ✅ PATCH /api/sessions/:connectRequestId/slots/:slotIndex/reschedule
// Only mentee can reschedule — picks a new slot from mentor's availability.
// No refund is issued on reschedule (the slot value carries over to the new slot).
// ─────────────────────────────────────────────────────────────
const rescheduleSlot = async (req, res) => {
  try {
    const { connectRequestId, slotIndex } = req.params;
    const { date, startTime, endTime } = req.body;
    const userId = req.user._id;

    if (!date || !startTime || !endTime) {
      return res.status(400).json({ message: "date, startTime, and endTime are required for the new slot" });
    }

    const connectRequest = await ConnectRequest.findById(connectRequestId);
    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, userId)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    // Only mentee can reschedule
    const isMentee = connectRequest.mentee.toString() === userId.toString();
    if (!isMentee) {
      return res.status(403).json({ message: "Only the mentee can reschedule a slot" });
    }

    if (connectRequest.status !== "ongoing") {
      return res.status(400).json({ message: "Session is not active" });
    }

    const validated = getValidatedSlot(connectRequest, slotIndex);
    if (!validated) {
      return res.status(400).json({ message: "Invalid slot index" });
    }

    const { idx } = validated;
    const oldSlot = connectRequest.selectedSlots[idx];

    if (oldSlot.status === "cancelled") {
      return res.status(400).json({ message: "This slot is already cancelled" });
    }
    if (oldSlot.menteeMarked && oldSlot.mentorMarked) {
      return res.status(400).json({ message: "Cannot reschedule a completed slot" });
    }

    // Check the new slot isn't already taken
    const newSlotTaken = connectRequest.selectedSlots.find(
      (s) =>
        s.date === date &&
        s.startTime === startTime &&
        s.endTime === endTime &&
        s.status !== "cancelled"
    );
    if (newSlotTaken) {
      return res.status(409).json({ message: "The new slot is already booked" });
    }

    // Compute day for the new slot
    const DAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    const newDay = DAYS[new Date(date + "T00:00:00").getDay()];

    // 1️⃣ Cancel the old slot and tag it as rescheduled
    connectRequest.selectedSlots[idx].status             = "cancelled";
    connectRequest.selectedSlots[idx].cancelledBy        = "mentee";
    connectRequest.selectedSlots[idx].cancelledAt        = new Date();
    connectRequest.selectedSlots[idx].cancellationReason = "rescheduled";
    connectRequest.selectedSlots[idx].isRescheduled      = true;

    // 2️⃣ Add the new slot tagged as a reschedule
    const newSlot = {
      day:           newDay,
      date,
      startTime,
      endTime,
      meetingLink:   "",
      menteeMarked:  false,
      mentorMarked:  false,
      completedAt:   null,
      status:        "booked",
      isRescheduled: true,
      rescheduledFromIndex: idx,
    };

    connectRequest.selectedSlots.push(newSlot);
    connectRequest.markModified("selectedSlots");
    await connectRequest.save({ validateBeforeSave: false });

    const newSlotIndex = connectRequest.selectedSlots.length - 1;

    const activeSlots = connectRequest.selectedSlots.filter(
      (s) => s.status !== "cancelled"
    );
    const completedCount = activeSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    const socketPayload = {
      connectRequestId,
      slots:          connectRequest.selectedSlots,
      totalSlots:     activeSlots.length,
      completedSlots: completedCount,
      progress:       activeSlots.length > 0
        ? Math.round((completedCount / activeSlots.length) * 100)
        : 0,
    };

    // Emit full slot update to both
    emitSlotUpdate(connectRequest, socketPayload);

    // Notify mentor with a dedicated event
    emitToOther(connectRequest, userId, "slot_rescheduled", {
      connectRequestId,
      oldSlotIndex:  idx,
      newSlotIndex,
      oldSlot:       connectRequest.selectedSlots[idx],
      newSlot:       connectRequest.selectedSlots[newSlotIndex],
    });

    return res.json({
      success: true,
      message: "Slot rescheduled successfully",
      oldSlot:      connectRequest.selectedSlots[idx],
      newSlot:      connectRequest.selectedSlots[newSlotIndex],
      oldSlotIndex: idx,
      newSlotIndex,
      ...socketPayload,
    });
  } catch (err) {
    console.error("❌ rescheduleSlot error:", err.message);
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/sessions/:connectRequestId/mentor-availability
// ─────────────────────────────────────────────────────────────
const getMentorAvailability = async (req, res) => {
  try {
    const { connectRequestId } = req.params;
    const duration = parseInt(req.query.duration) || 60;

    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .select("mentor mentee status selectedSlots additionalSlots")
      .lean();

    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const availability = await Availability.findOne({ mentor: connectRequest.mentor }).lean();

    if (!availability || !availability.specificDates?.length) {
      return res.json({ success: true, slots: [], timezone: "Asia/Kolkata" });
    }

    // Block all non-cancelled booked slots from appearing in picker
    const bookedSlots = [
      ...(connectRequest.selectedSlots || []).filter((s) => s.status !== "cancelled"),
      ...(connectRequest.additionalSlots || []),
    ].map((s) => ({
      date: s.date, startTime: s.startTime, endTime: s.endTime,
    }));

    const { generateSlotsFromSpecificDates } = require("../utils/generateSlots");
    const grouped = generateSlotsFromSpecificDates(
      availability.specificDates,
      duration,
      bookedSlots
    );

    return res.json({
      success:          true,
      slots:            grouped,
      timezone:         availability.timezone || "Asia/Kolkata",
      sessionDurations: availability.sessionDurations || [30, 60],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getSlots,
  setMeetingLink,
  markSlotComplete,
  addSlot,
  cancelSlot,
  rescheduleSlot,
  getMentorAvailability,
};