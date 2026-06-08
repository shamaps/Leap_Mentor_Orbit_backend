// backend/repositories/feedback.repository.js
const Feedback = require("../models/Feedback");
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile = require("../models/MentorProfile");

// ─────────────────────────────────────────────────────────────
// CONNECT REQUEST
// ─────────────────────────────────────────────────────────────

const findSessionById = (id) =>
    ConnectRequest.findById(id)
        .select("mentor mentee status selectedSlots")
        .lean();

const findSessionForRead = (id) =>
    ConnectRequest.findById(id)
        .select("mentor mentee status")
        .lean();

// ─────────────────────────────────────────────────────────────
// FEEDBACK
// ─────────────────────────────────────────────────────────────

const findExistingFeedback = (query) =>
    Feedback.findOne(query);

const createFeedback = (data) =>
    Feedback.create(data);

const findFeedbackById = (id) =>
    Feedback.findById(id)
        .populate("from", "name email")
        .populate("to", "name email")
        .lean();

const findFeedbackBySession = (connectRequestId) =>
    Feedback.find({ connectRequest: connectRequestId })
        .populate("from", "name email")
        .lean();

const findAllFeedbackForMentor = (mentorUserId) =>
    Feedback.find({ to: mentorUserId }).lean();

// ─────────────────────────────────────────────────────────────
// MENTOR PROFILE
// ─────────────────────────────────────────────────────────────

const updateMentorAvgRating = (mentorUserId, avgRating) =>
    MentorProfile.findOneAndUpdate(
        { user: mentorUserId },
        { $set: { avgRating } }
    );

module.exports = {
    findSessionById,
    findSessionForRead,
    findExistingFeedback,
    createFeedback,
    findFeedbackById,
    findFeedbackBySession,
    findAllFeedbackForMentor,
    updateMentorAvgRating,
};