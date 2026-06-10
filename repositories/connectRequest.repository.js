// repositories/connectRequest.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile = require("../models/MentorProfile");
const MenteeProfile = require("../models/MenteeProfile");
const { ACTIVE_SESSION_STATUSES, VALID_REQUEST_STATUSES } = require("../config/constants");

// ─────────────────────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────────────────────

/**
 * Find a pending request between a specific mentee and mentor.
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
 * Find a request by ID — plain document (for mutation).
 */
const findRequestById = async (id) => {
  return await ConnectRequest.findById(id);
};

/**
 * Find a request by ID with mentee + mentor populated (for mutation/response).
 */
const findRequestByIdWithUsers = async (id) => {
  return await ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email");
};

/**
 * Find a request by ID with mentee + mentor populated — lean (read-only).
 */
const findRequestByIdLean = async (id) => {
  return await ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .lean();
};

/**
 * All requests sent by a mentee, newest first.
 */
const findMyRequests = async (menteeId) => {
  return await ConnectRequest.find({ mentee: menteeId })
    .populate("mentor", "name email")
    .populate("referredTo", "name email")
    .sort({ requestedAt: -1 })
    .lean();
};

/**
 * All incoming requests for a mentor, optionally filtered by status.
 */
const findIncomingRequests = async (mentorId, status) => {
  const filter = { mentor: mentorId };
  if (status && VALID_REQUEST_STATUSES.includes(status)) {
    filter.status = status;
  }
  return await ConnectRequest.find(filter)
    .populate("mentee", "name email")
    .populate("referredBy", "name email")
    .sort({ requestedAt: -1 })
    .lean();
};

/**
 * All ongoing + completed sessions for a user (as either mentee or mentor).
 */
const findOngoingConnects = async (userId) => {
  return await ConnectRequest.find({
    status: { $in: ACTIVE_SESSION_STATUSES },
    $or: [{ mentee: userId }, { mentor: userId }],
  })
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .sort({ paidAt: -1 })
    .lean();
};

/**
 * Check whether a referral already exists between a mentee and target mentor.
 */
const findExistingReferral = async (menteeId, mentorId) => {
  return await ConnectRequest.findOne({
    mentee: menteeId,
    mentor: mentorId,
    status: "pending",
  });
};

// ─────────────────────────────────────────────────────────────
// PROFILE LOOKUPS
// ─────────────────────────────────────────────────────────────

const findMentorProfile = async (userId) => {
  return await MentorProfile.findOne({ user: userId })
    .select("currentRole company profilePicture skills hourlyRate avgRating bio")
    .lean();
};

const findMentorProfileFull = async (userId) => {
  return await MentorProfile.findOne({ user: userId })
    .select("currentRole company industry bio hourlyRate avgRating yearsOfExperience profilePicture skills")
    .lean();
};

const findMenteeProfile = async (userId) => {
  return await MenteeProfile.findOne({ user: userId })
    .select("currentRole company profilePicture skills bio interestedFields")
    .lean();
};

// ─────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Create a new connect request document.
 */
const createConnectRequest = async (data) => {
  return await ConnectRequest.create(data);
};

/**
 * Persist changes to an existing request document.
 */
const saveRequest = async (request) => {
  return await request.save();
};

/**
 * Reject all other pending requests from different mentees
 * that conflict with the newly confirmed slot.
 */
const rejectConflictingSlots = async (requestId, mentorId, confirmedSlot) => {
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
 * Hard delete a request by ID.
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
  findExistingReferral,
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