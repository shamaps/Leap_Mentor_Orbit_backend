// backend/controllers/session.controller.js
const mongoose       = require("mongoose");
const ConnectRequest = require("../models/ConnectRequest");
const Availability   = require("../models/Availability");
const releaseEscrow  = require("../utils/releaseEscrow");

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

// ─────────────────────────────────────────────────────────────
// GET /api/sessions/:connectRequestId/slots
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

    const completedCount = connectRequest.selectedSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    const payload = {
      connectRequestId,
      slots:         connectRequest.selectedSlots,
      totalSlots:    connectRequest.selectedSlots.length,
      completedSlots: completedCount,
      progress:      Math.round((completedCount / connectRequest.selectedSlots.length) * 100),
    };

    // ✅ Emit to other participant instantly
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

    const allComplete = connectRequest.selectedSlots.every(
      (s) => s.menteeMarked && s.mentorMarked
    );

    let releaseResult = null;
    if (allComplete) {
      releaseResult = await releaseEscrow(connectRequestId, mongoSession);
    }

    await mongoSession.commitTransaction();

    const completedCount = connectRequest.selectedSlots.filter(
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
      totalSlots:    connectRequest.selectedSlots.length,
      progress:      Math.round((completedCount / connectRequest.selectedSlots.length) * 100),
      escrowRelease: releaseResult,
    };

    // ✅ Emit full slots update to both parties instantly
    emitSlotUpdate(connectRequest, {
      connectRequestId,
      slots:          connectRequest.selectedSlots,
      totalSlots:     connectRequest.selectedSlots.length,
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

    const slotTaken = connectRequest.selectedSlots.find(
      (s) => s.date === date && s.startTime === startTime && s.endTime === endTime
    );
    if (slotTaken) {
      return res.status(409).json({ message: "This slot already exists in the session" });
    }

    const newSlot = {
      day, date, startTime, endTime,
      meetingLink:  "",
      menteeMarked: false,
      mentorMarked: false,
      completedAt:  null,
    };

    connectRequest.selectedSlots.push(newSlot);
    connectRequest.markModified("selectedSlots");
    await connectRequest.save();

    const completedCount = connectRequest.selectedSlots.filter(
      (s) => s.menteeMarked && s.mentorMarked
    ).length;

    const socketPayload = {
      connectRequestId,
      slots:          connectRequest.selectedSlots,
      totalSlots:     connectRequest.selectedSlots.length,
      completedSlots: completedCount,
      progress:       Math.round((completedCount / connectRequest.selectedSlots.length) * 100),
    };

    // ✅ Notify both parties instantly about new slot
    emitSlotUpdate(connectRequest, socketPayload);

    return res.status(201).json({
      success: true,
      message: "Additional session slot added successfully",
      slot:    newSlot,
      ...socketPayload,
    });
  } catch (err) {
    console.error("❌ addSlot error:", err.message);
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
      .select("mentor mentee status selectedSlots")
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

    const bookedSlots = (connectRequest.selectedSlots || []).map((s) => ({
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

module.exports = { getSlots, setMeetingLink, markSlotComplete, addSlot, getMentorAvailability };