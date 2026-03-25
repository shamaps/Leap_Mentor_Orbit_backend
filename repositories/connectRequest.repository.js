// repositories/connectRequest.repository.js
const mongoose = require("mongoose");
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile  = require("../models/MentorProfile");
const MenteeProfile  = require("../models/MenteeProfile");

const findPendingRequest = async (menteeId, mentorId) => {
  return await ConnectRequest.findOne({
    mentee:  menteeId,
    mentor:  mentorId,
    status: "pending",
  });
};

const findSlotConflict = async (mentorId, slot) => {
  return await ConnectRequest.findOne({
    mentor: mentorId,
    status: { $in: ["pending", "accepted"] },
    "selectedSlots.date":      slot.date,
    "selectedSlots.startTime": slot.startTime,
    "selectedSlots.endTime":   slot.endTime,
  });
};

const createConnectRequest = async (data) => {
  return await ConnectRequest.create(data);
};

const findRequestById = async (id) => {
  return await ConnectRequest.findById(id);
};

const findRequestByIdWithUsers = async (id) => {
  return await ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email");
};

const findRequestByIdLean = async (id) => {
  return await ConnectRequest.findById(id)
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .lean();
};

const findMyRequests = async (menteeId) => {
  return await ConnectRequest.find({ mentee: menteeId })
    .populate("mentor", "name email")
    .populate("referredTo", "name email")
    .sort({ requestedAt: -1 })
    .lean();
};

const findIncomingRequests = async (mentorId, status) => {
  const filter = { mentor: mentorId };
  if (status && ["pending", "accepted", "rejected", "referred"].includes(status)) {
    filter.status = status;
  }
  return await ConnectRequest.find(filter)
    .populate("mentee", "name email")
    .populate("referredBy", "name email")
    .sort({ requestedAt: -1 })
    .lean();
};

const saveRequest = async (request) => {
  return await request.save();
};

const rejectConflictingSlots = async (requestId, mentorId, confirmedSlot) => {
  return await ConnectRequest.updateMany(
    {
      _id:    { $ne: requestId },
      mentor: mentorId,
      status: "pending",
      "selectedSlots.date":      confirmedSlot.date,
      "selectedSlots.startTime": confirmedSlot.startTime,
      "selectedSlots.endTime":   confirmedSlot.endTime,
    },
    { $set: { status: "rejected", respondedAt: new Date() } }
  );
};

const deleteRequestById = async (id) => {
  return await ConnectRequest.findByIdAndDelete(id);
};

const findExistingReferral = async (menteeId, mentorId) => {
  return await ConnectRequest.findOne({
    mentee:  menteeId,
    mentor:  mentorId,
    status: "pending",
  });
};

const findOngoingConnects = async (userId) => {
  return await ConnectRequest.find({
    status: { $in: ["ongoing", "completed"] },
    $or: [{ mentee: userId }, { mentor: userId }],
  })
    .populate("mentee", "name email")
    .populate("mentor", "name email")
    .sort({ paidAt: -1 })
    .lean();
};

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

const findMentorProfileForDetail = async (userId) => {
  return await MentorProfile.findOne({ user: userId })
    .select("currentRole company profilePicture skills hourlyRate avgRating bio")
    .lean();
};

module.exports = {
  findPendingRequest,
  findSlotConflict,
  createConnectRequest,
  findRequestById,
  findRequestByIdWithUsers,
  findRequestByIdLean,
  findMyRequests,
  findIncomingRequests,
  saveRequest,
  rejectConflictingSlots,
  deleteRequestById,
  findExistingReferral,
  findOngoingConnects,
  findMentorProfile,
  findMentorProfileFull,
  findMenteeProfile,
  findMentorProfileForDetail,
};