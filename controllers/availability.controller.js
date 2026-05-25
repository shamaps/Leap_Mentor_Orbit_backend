// controllers/availability.controller.js
const Availability   = require("../models/Availability");
const ConnectRequest = require("../models/ConnectRequest");
const SlotLock       = require("../models/SlotLock");
const { generateSlotsFromSpecificDates } = require("../utils/generateSlots");

// GET /api/availability/me
const getMyAvailability = async (req, res) => {
  try {
    let availability = await Availability.findOne({ mentor: req.user._id });

    if (!availability) {
      return res.status(200).json({
        mentor: req.user._id,
        timezone: "Asia/Kolkata",
        sessionDurations: [30, 60],
        googleCalendarConnected: false,
        specificDates: [],
        isNew: true,
      });
    }

    return res.json(availability);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/availability
// ─────────────────────────────────────────────────────────────
const createAvailability = async (req, res) => {
  try {
    const existing = await Availability.findOne({ mentor: req.user._id });
    if (existing) {
      return res.status(409).json({
        message: "Availability already exists. Use PATCH /api/availability/me to update.",
      });
    }

    const { timezone, sessionDurations, specificDates } = req.body;

    const availability = await Availability.create({
      mentor:           req.user._id,
      timezone:         timezone         || "Asia/Kolkata",
      sessionDurations: sessionDurations || [30, 60],
      specificDates:    specificDates    || [],
    });

    return res.status(201).json({ message: "Availability created successfully", availability });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/availability/me
// ─────────────────────────────────────────────────────────────
const updateAvailability = async (req, res) => {
  try {
    const allowedFields = [
      "timezone",
      "sessionDurations",
      "specificDates",
      "googleCalendarConnected",
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided to update" });
    }

    const availability = await Availability.findOneAndUpdate(
      { mentor: req.user._id },
      { $set: updates },
      { new: true, runValidators: true, upsert: true }
    );

    return res.json({ message: "Availability updated successfully", availability });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/availability/:mentorId  (public)
// ─────────────────────────────────────────────────────────────
const getMentorAvailability = async (req, res) => {
  try {
    const availability = await Availability.findOne({ mentor: req.params.mentorId });

    if (!availability) {
      return res.status(404).json({ message: "Availability not set by this mentor" });
    }

    return res.json({
      timezone:         availability.timezone,
      sessionDurations: availability.sessionDurations,
      specificDates:    availability.specificDates,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// DELETE /api/availability/me
// ─────────────────────────────────────────────────────────────
const deleteAvailability = async (req, res) => {
  try {
    await Availability.findOneAndDelete({ mentor: req.user._id });
    return res.json({ message: "Availability cleared successfully" });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/availability/:mentorId/slots?duration=60
// ─────────────────────────────────────────────────────────────
const getAvailableSlots = async (req, res) => {
  try {
    const { mentorId } = req.params;
    const duration = Number.parseInt(req.query.duration) || 60;

    if (![30, 45, 60].includes(duration)) {
      return res.status(400).json({ message: "Duration must be 30, 45, or 60 minutes" });
    }

    const availability = await Availability.findOne({ mentor: mentorId });
    if (!availability) {
      return res.status(404).json({ message: "Availability not set by this mentor" });
    }

   const bookedRequests = await ConnectRequest.find({
      mentor: mentorId,
      status: { $in: ["pending", "accepted","ongoing"] },
    }).select("selectedSlots selectedSlot").lean();

    const bookedSlots = bookedRequests.flatMap((r) => {
      const slots = r.selectedSlots || (r.selectedSlot ? [r.selectedSlot] : []);
      return slots.map((slot) => ({
        date:      slot.date,
        startTime: slot.startTime,
        endTime:   slot.endTime,
      }));
    });

    // Fetch active locks from other mentees and merge with booked slots
    const activeLocks = await SlotLock.find({
      mentorId: mentorId,
      lockedBy: { $ne: req.user._id },
    }).lean();

    const lockedSlots = activeLocks.map((l) => ({
      date:      l.date,
      startTime: l.startTime,
      endTime:   l.endTime,
    }));

    const allBlockedSlots = [...bookedSlots, ...lockedSlots];

    if (!availability.specificDates?.length) {
      return res.json({
        timezone:         availability.timezone,
        sessionDurations: availability.sessionDurations,
        slots: [],
      });
    }

    const grouped = generateSlotsFromSpecificDates(
      availability.specificDates,
      duration,
      allBlockedSlots 
    );
    return res.json({
      timezone:         availability.timezone,
      sessionDurations: availability.sessionDurations,
      slots:            grouped,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getMyAvailability,
  createAvailability,
  updateAvailability,
  getMentorAvailability,
  deleteAvailability,
  getAvailableSlots,
};