// backend/controllers/session.controller.js
const mongoose = require("mongoose");
const ConnectRequest = require("../models/ConnectRequest");
const releaseEscrow = require("../utils/releaseEscrow");

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

// ─────────────────────────────────────────────────────────────
// GET /api/sessions/:connectRequestId/slots
// Returns all selectedSlots for a session
// ─────────────────────────────────────────────────────────────
const getSlots = async (req, res) => {
  try {
    const { connectRequestId } = req.params;

    const connectRequest = await ConnectRequest.findById(connectRequestId)
      .select("mentor mentee selectedSlots status")
      .lean();

    if (!connectRequest) {
      return res.status(404).json({ message: "Session not found" });
    }
    if (!assertParticipant(connectRequest, req.user._id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const completedCount = connectRequest.selectedSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    return res.json({
      success: true,
      slots: connectRequest.selectedSlots,
      totalSlots: connectRequest.selectedSlots.length,
      completedSlots: completedCount,
      progress: connectRequest.selectedSlots.length > 0
        ? Math.round((completedCount / connectRequest.selectedSlots.length) * 100)
        : 0,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/meeting-link
// Mentor or mentee sets meeting link for a slot
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

    // ✅ Update meeting link for this slot
    connectRequest.selectedSlots[validated.idx].meetingLink = meetingLink.trim();
    connectRequest.markModified("selectedSlots");
    await connectRequest.save();

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
// Mentor or mentee marks a slot as complete
// When BOTH mark it → slot.completedAt is set
// When ALL slots complete → escrow auto-releases to mentor
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
    const slot = connectRequest.selectedSlots[idx];
    const isMentor = connectRequest.mentor.toString() === userId.toString();
    const isMentee = connectRequest.mentee.toString() === userId.toString();

    // ✅ Already fully completed
    if (slot.menteeMarked && slot.mentorMarked) {
      await mongoSession.abortTransaction();
      return res.status(400).json({ message: "This session is already marked complete by both parties" });
    }

    // ✅ Set the appropriate mark
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

    // ✅ Check if BOTH have now marked this slot
    const bothMarked =
      connectRequest.selectedSlots[idx].menteeMarked &&
      connectRequest.selectedSlots[idx].mentorMarked;

    if (bothMarked) {
      connectRequest.selectedSlots[idx].completedAt = new Date();
      console.log(`✅ Slot ${idx} completed by both parties`);
    }

    connectRequest.markModified("selectedSlots");
    await connectRequest.save({ session: mongoSession });

    // ✅ Check if ALL slots are now complete
    const allComplete = connectRequest.selectedSlots.every(
      (s) => s.menteeMarked && s.mentorMarked
    );

    let releaseResult = null;
    if (allComplete) {
      console.log(`🎉 All slots complete — releasing escrow for ${connectRequestId}`);
      releaseResult = await releaseEscrow(connectRequestId, mongoSession);
    }

    await mongoSession.commitTransaction();

    const completedCount = connectRequest.selectedSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    return res.json({
      success: true,
      message: allComplete
        ? "All sessions complete! Tokens released to mentor."
        : bothMarked
          ? "Session marked complete by both parties."
          : `Session marked complete. Waiting for ${isMentee ? "mentor" : "mentee"} to confirm.`,
      slot: connectRequest.selectedSlots[idx],
      slotIndex: idx,
      bothMarked,
      allComplete,
      completedSlots: completedCount,
      totalSlots: connectRequest.selectedSlots.length,
      progress: Math.round((completedCount / connectRequest.selectedSlots.length) * 100),
      escrowRelease: releaseResult,
    });

  } catch (err) {
    await mongoSession.abortTransaction();
    console.error("❌ markSlotComplete error:", err.message);
    return res.status(500).json({ message: err.message });
  } finally {
    mongoSession.endSession();
  }
};

module.exports = { getSlots, setMeetingLink, markSlotComplete };