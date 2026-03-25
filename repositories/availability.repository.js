// repositories/availability.repository.js
const Availability   = require("../models/Availability");
const ConnectRequest = require("../models/ConnectRequest");
const SlotLock       = require("../models/SlotLock");

const findAvailabilityByMentor = async (mentorId) => {
  return await Availability.findOne({ mentor: mentorId });
};

const createAvailability = async ({ mentorId, timezone, sessionDurations, specificDates }) => {
  return await Availability.create({
    mentor:           mentorId,
    timezone:         timezone         || "Asia/Kolkata",
    sessionDurations: sessionDurations || [30, 60],
    specificDates:    specificDates    || [],
  });
};

const updateAvailability = async (mentorId, updates) => {
  return await Availability.findOneAndUpdate(
    { mentor: mentorId },
    { $set: updates },
    { new: true, runValidators: true, upsert: true }
  );
};

const deleteAvailability = async (mentorId) => {
  return await Availability.findOneAndDelete({ mentor: mentorId });
};

const findBookedRequests = async (mentorId) => {
  return await ConnectRequest.find({
    mentor: mentorId,
    status: { $in: ["pending", "accepted", "ongoing"] },
  }).select("selectedSlots selectedSlot").lean();
};

const findActiveLocks = async (mentorId, userId) => {
  return await SlotLock.find({
    mentorId: mentorId,
    lockedBy: { $ne: userId },
  }).lean();
};

module.exports = {
  findAvailabilityByMentor,
  createAvailability,
  updateAvailability,
  deleteAvailability,
  findBookedRequests,
  findActiveLocks,
};