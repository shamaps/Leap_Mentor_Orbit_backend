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
    Feedback.findOne(query).select("_id").lean();

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
    Feedback.find({ to: mentorUserId })
        .select("rating slotIndex from")
        .lean();

// Computes { avg, count } for a mentor's ratings via aggregation.
// Returns [] (not [{avg: null, count: 0}]) when there are zero ratings,
// matching refreshMentorAvgRating's `result ? ... : 0` fallback.
const computeMentorAvgRating = (mentorUserId) =>
    Feedback.aggregate([
        { $match: { to: mentorUserId } },
        {
            $group: {
                _id: "$to",
                avg: { $avg: "$rating" },
                count: { $sum: 1 },
            },
        },
    ]);

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
    computeMentorAvgRating,
    updateMentorAvgRating,
};