// repositories/availability.repository.js
const Availability = require("../models/Availability");
const ConnectRequest = require("../models/ConnectRequest");
const SlotLock = require("../models/SlotLock");
const { PLATFORM_TIMEZONE } = require("../config/constants");

/**
 * Query database engine layer to resolve single mentor settings structure matching provided token user parameters.
 * * @function findAvailabilityByMentor
 * @param {string} mentorId - User target search criterion.
 * @returns {Promise<Object|null>} Mongoose document pointer array instance resolve loop, otherwise null.
 */
const findAvailabilityByMentor = async (mentorId) => {
  return await Availability.findOne({ mentor: mentorId });
};

/**
 * Commits a structured setup block initializing user options configurations.
 * * @function createAvailability
 * @param {Object} payloadData - Raw parameters mapping structural layout requirements.
 * @param {string} payloadData.mentorId - System authentication token identity reference string.
 * @param {string} [payloadData.timezone] - Chosen operations timezone configuration string fallback.
 * @param {number[]} [payloadData.sessionDurations] - Collection of allowed session windows array mapping.
 * @param {Object[]} [payloadData.specificDates] - Core structural setup block initializing hours.
 * @returns {Promise<Object>} Freshly written database record model entity layout.
 */
const createAvailability = async ({ mentorId, timezone, sessionDurations, specificDates }) => {
  return await Availability.create({
    mentor: mentorId,
    timezone: timezone || PLATFORM_TIMEZONE,
    sessionDurations: sessionDurations || [30, 60],
    specificDates: specificDates || [],
  });
};

/**
 * Atomic processing executing modification options or fallback creation properties.
 * * @function updateAvailability
 * @param {string} mentorId - The target query configuration target user.
 * @param {Object} updates - Verified object modifications keys payload.
 * @returns {Promise<Object>} The updated standard availability database profile model.
 */
const updateAvailability = async (mentorId, updates) => {
  return await Availability.findOneAndUpdate(
    { mentor: mentorId },
    { $set: updates },
    { new: true, runValidators: true, upsert: true }
  );
};

/**
 * Completely evicts target mentor availability configurations.
 * * @function deleteAvailability
 * @param {string} mentorId - Targeted search identity index parameter.
 * @returns {Promise<Object|null>} Document removed context return confirmation data.
 */
const deleteAvailability = async (mentorId) => {
  return await Availability.findOneAndDelete({ mentor: mentorId });
};

/**
 * Searches active platform operational appointments blocking overlapping times matrix creation.
 * * @function findBookedRequests
 * @param {string} mentorId - Targeted owner key lookup parameter.
 * @returns {Promise<Object[]>} Collection array of lean plain objects containing selected slots parameters.
 */
const findBookedRequests = async (mentorId) => {
  return await ConnectRequest.find({
    mentor: mentorId,
    status: { $in: ["pending", "accepted", "ongoing"] },
  }).select("selectedSlots selectedSlot").lean();
};

/**
 * Extracts locks created by opposing consumers to prevent duplicate slot registration conflicts.
 * * @function findActiveLocks
 * @param {string} mentorId - Host owner target key.
 * @param {string} userId - The active user looking to reserve a slot (omitted from block rules).
 * @returns {Promise<Object[]>} Collection listing opposing locked time slots.
 */
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