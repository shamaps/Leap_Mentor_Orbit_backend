// repositories/connectRequest.repository.js

/**
 * @fileoverview Data-access layer for ConnectRequest documents.
 * All database queries are isolated here; the service layer never
 * touches Mongoose models directly.
 *
 * @module repositories/connectRequest
 */

const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile = require("../models/MentorProfile");
const MenteeProfile = require("../models/MenteeProfile");
const { ACTIVE_SESSION_STATUSES, VALID_REQUEST_STATUSES } = require("../config/constants");
const logger = require("../utils/logger");

/**
 * Default field projection used for list queries.
 * Excludes heavy / internal fields (e.g. raw slot arrays stored elsewhere)
 * while keeping everything the UI needs for cards and tables.
 *
 * @constant {string}
 */
const CONNECT_REQUEST_LIST_SELECT =
  "_id status message requestedAt sessionRate sessionCount totalAmount " +
  "paymentStatus paidAt selectedSlots confirmedSlot additionalSlots " +
  "completedAt mentor mentee referredTo referredBy"

// ─────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────

/**
 * Find a pending request between a specific mentee and mentor.
 *
 * @param {mongoose.Types.ObjectId|string} menteeId
 * @param {mongoose.Types.ObjectId|string} mentorId
 * @returns {Promise<import('../models/ConnectRequest').ConnectRequestDoc|null>}
 */
const findPendingRequest = async (menteeId, mentorId) => {
  return await ConnectRequest.findOne({
    mentee: menteeId,
    mentor: mentorId,
    status: "pending",
  });
};

/**
 * Check if a given slot is already taken by another pending/accepted request
 * for the same mentor.
 *
 * @param {mongoose.Types.ObjectId|string} mentorId
 * @param {{ date: string, startTime: string, endTime: string }} slot
 * @returns {Promise<import('../models/ConnectRequest').ConnectRequestDoc|null>}
 *   The conflicting document, or `null` if the slot is free.
 */
const findSlotConflict = async (mentorId, slot) => {
  return await ConnectRequest.findOne({
    mentor: mentorId,
    status: { $in: ["pending", "accepted"] },
    "selectedSlots.date": slot.date,
    "selectedSlots.startTime": slot.startTime,
    "selectedSlots.endTime": slot.endTime,
  });
};

/**
 * Find a request by ID — returns a mutable Mongoose document (for save/update).
 *
 * @param {string} id - ConnectRequest `_id`
 * @returns {Promise<import('../models/ConnectRequest').ConnectRequestDoc|null>}
 */
const findRequestById = async (id) => {
  return await ConnectRequest.findById(id);
};

/**
 * Find a request by ID with `mentee` and `mentor` user refs populated.
 * Returns a mutable Mongoose document suitable for mutation and save.
 *
 * @param {string} id - ConnectRequest `_id`
 * @returns {Promise<import('../models/ConnectRequest').ConnectRequestDoc|null>}
 */
const findRequestByIdWithUsers = async (id) => {
  return await ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email");
};

/**
 * Find a request by ID with `mentee` and `mentor` populated — lean (read-only).
 * Preferred for read-only operations; faster and returns a plain JS object.
 *
 * @param {string} id - ConnectRequest `_id`
 * @returns {Promise<Object|null>} Plain JS object, or `null` if not found
 */
const findRequestByIdLean = async (id) => {
  return await ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .lean();
};

/**
 * All requests sent by a mentee, newest first.
 * Populates `mentor` and `referredTo` user refs; returns lean objects.
 *
 * @param {mongoose.Types.ObjectId|string} menteeId
 * @returns {Promise<Object[]>}
 */
const findMyRequests = async (menteeId) => {
  return await ConnectRequest.find({ mentee: menteeId })
    .select(CONNECT_REQUEST_LIST_SELECT)
    .populate("mentor", "name email")
    .populate("referredTo", "name email")
    .sort({ requestedAt: -1 })
    .lean();
};

/**
 * All incoming requests for a mentor, optionally filtered by status.
 * Populates `mentee` and `referredBy` user refs; returns lean objects.
 *
 * @param {mongoose.Types.ObjectId|string} mentorId
 * @param {string} [status] - Status to filter by; ignored if not in VALID_REQUEST_STATUSES
 * @returns {Promise<Object[]>}
 */
const findIncomingRequests = async (mentorId, status) => {
  const filter = { mentor: mentorId };
  if (status && VALID_REQUEST_STATUSES.includes(status)) {
    filter.status = status;
  }
  return await ConnectRequest.find(filter)
    .select(CONNECT_REQUEST_LIST_SELECT)
    .populate("mentee", "name email")
    .populate("referredBy", "name email")
    .sort({ requestedAt: -1 })
    .lean();
};

/**
 * All ongoing + completed sessions for a user (as either mentee or mentor).
 * Matches on `ACTIVE_SESSION_STATUSES` and returns lean objects sorted by `paidAt`.
 *
 * @param {mongoose.Types.ObjectId|string} userId
 * @returns {Promise<Object[]>}
 */
const findOngoingConnects = async (userId) => {
  return await ConnectRequest.find({
    status: { $in: ACTIVE_SESSION_STATUSES },
    $or: [{ mentee: userId }, { mentor: userId }],
  })
    .select(CONNECT_REQUEST_LIST_SELECT)
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .sort({ paidAt: -1 })
    .lean();
};

// ─────────────────────────────────────────────────────────────
// PROFILE LOOKUPS
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a mentor's public-facing profile (lightweight — for list cards).
 *
 * @param {mongoose.Types.ObjectId|string} userId - The mentor's user `_id`
 * @returns {Promise<Object|null>} Lean MentorProfile subset, or `null`
 */
const findMentorProfile = async (userId) => {
  return await MentorProfile.findOne({ user: userId })
    .select("currentRole company profilePicture skills hourlyRate avgRating bio")
    .lean();
};

/**
 * Fetch a mentor's full profile (for referral cards / detail views).
 *
 * @param {mongoose.Types.ObjectId|string} userId - The mentor's user `_id`
 * @returns {Promise<Object|null>} Lean MentorProfile subset with extended fields, or `null`
 */
const findMentorProfileFull = async (userId) => {
  return await MentorProfile.findOne({ user: userId })
    .select("currentRole company industry bio hourlyRate avgRating yearsOfExperience profilePicture skills")
    .lean();
};

/**
 * Fetch a mentee's profile.
 *
 * @param {mongoose.Types.ObjectId|string} userId - The mentee's user `_id`
 * @returns {Promise<Object|null>} Lean MenteeProfile subset, or `null`
 */
const findMenteeProfile = async (userId) => {
  return await MenteeProfile.findOne({ user: userId })
    .select("currentRole company profilePicture skills bio interestedFields")
    .lean();
};

// ─────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Create a new ConnectRequest document.
 *
 * @param {Object} data - Fields to persist (must satisfy the ConnectRequest schema)
 * @returns {Promise<import('../models/ConnectRequest').ConnectRequestDoc>}
 */
const createConnectRequest = async (data) => {
  logger.debug("createConnectRequest called", { mentorId: data.mentor?.toString(), menteeId: data.mentee?.toString() });
  return await ConnectRequest.create(data);
};

/**
 * Persist changes to an existing ConnectRequest document (calls `.save()`).
 *
 * @param {import('../models/ConnectRequest').ConnectRequestDoc} request - Mutated Mongoose document
 * @returns {Promise<import('../models/ConnectRequest').ConnectRequestDoc>}
 */
const saveRequest = async (request) => {
  logger.debug("saveRequest called", { requestId: request._id?.toString(), status: request.status });
  return await request.save();
};

/**
 * Bulk-reject all other pending requests from different mentees that
 * conflict with a newly confirmed slot. Used after a mentor accepts a request
 * to automatically clean up overlapping proposals.
 *
 * @param {mongoose.Types.ObjectId|string} requestId    - The accepted request (excluded from update)
 * @param {mongoose.Types.ObjectId|string} mentorId
 * @param {{ date: string, startTime: string, endTime: string }} confirmedSlot
 * @returns {Promise<import('mongoose').UpdateWriteOpResult>}
 */
const rejectConflictingSlots = async (requestId, mentorId, confirmedSlot) => {
  logger.debug("rejectConflictingSlots called", { requestId: requestId?.toString(), mentorId: mentorId?.toString(), confirmedSlot });
  return await ConnectRequest.updateMany(
    {
      _id: { $ne: requestId },
      mentor: mentorId,
      status: "pending",
      "selectedSlots.date": confirmedSlot.date,
      "selectedSlots.startTime": confirmedSlot.startTime,
      "selectedSlots.endTime": confirmedSlot.endTime,
    },
    { $set: { status: "rejected", respondedAt: new Date() } }
  );
};

/**
 * Hard-delete a ConnectRequest by its ID.
 *
 * @param {string} id - ConnectRequest `_id`
 * @returns {Promise<import('../models/ConnectRequest').ConnectRequestDoc|null>}
 *   The deleted document, or `null` if not found.
 */
const deleteRequestById = async (id) => {
  return await ConnectRequest.findByIdAndDelete(id);
};

module.exports = {
  // reads
  findPendingRequest,
  findSlotConflict,
  findRequestById,
  findRequestByIdWithUsers,
  findRequestByIdLean,
  findMyRequests,
  findIncomingRequests,
  findOngoingConnects,
  // profile lookups
  findMentorProfile,
  findMentorProfileFull,
  findMenteeProfile,
  // writes
  createConnectRequest,
  saveRequest,
  rejectConflictingSlots,
  deleteRequestById,
};