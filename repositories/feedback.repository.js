// backend/repositories/feedback.repository.js
const Feedback = require("../models/Feedback");
const ConnectRequest = require("../models/ConnectRequest");
const MentorProfile = require("../models/MentorProfile");

/**
 * Resolves a single mentorship request document mapping critical parameters context.
 * * @function findSessionById
 * @param {string} id - Database row locator index primary key.
 * @returns {Promise<Object|null>} Lean document model representation parameters or null.
 */
const findSessionById = (id) =>
    ConnectRequest.findById(id)
        .select("mentor mentee status selectedSlots")
        .lean();

/**
 * High-performance stripped session profile selection for visibility check functions.
 * * @function findSessionForRead
 * @param {string} id - Database tracking locator string.
 * @returns {Promise<Object|null>} Lean plain data template row mapping properties.
 */
const findSessionForRead = (id) =>
    ConnectRequest.findById(id)
        .select("mentor mentee status")
        .lean();

/**
 * Evaluates entry properties checking for overlapping historical duplicate configurations.
 * * @function findExistingFeedback
 * @param {Object} query - Formatted dynamic evaluation criteria parameters checking keys.
 * @returns {Promise<Object|null>} Limited single ID match pointer context envelope if true, else null.
 */
const findExistingFeedback = (query) =>
    Feedback.findOne(query).select("_id").lean();

/**
 * Stores a fresh structural feedback log document mapping attributes.
 * * @function createFeedback
 * @param {Object} data - Schema constraints defined criteria object.
 * @returns {Promise<Object>} Freshly written database record model instance.
 */
const createFeedback = (data) =>
    Feedback.create(data);

/**
 * Resolves deep feedback properties fully populated with account descriptors.
 * * @function findFeedbackById
 * @param {any} id - Target object identifier key tracking records.
 * @returns {Promise<Object|null>} Fully expanded lean document representation data map.
 */
const findFeedbackById = (id) =>
    Feedback.findById(id)
        .populate("from", "name email")
        .populate("to", "name email")
        .lean();

/**
 * Returns a collection mapping historical input entries tied to a specific session identifier.
 * * @function findFeedbackBySession
 * @param {string} connectRequestId - Targeted connection tracking search parameter key.
 * @returns {Promise<Object[]>} Collection array of lean objects containing tracking data.
 */
const findFeedbackBySession = (connectRequestId) =>
    Feedback.find({ connectRequest: connectRequestId })
        .populate("from", "name email")
        .lean();

/**
 * Isolates scores received by a target mentor profile across active assignments.
 * * @function findAllFeedbackForMentor
 * @param {any} mentorUserId - Primary account indicator pointer value.
 * @returns {Promise<Object[]>} Lean subset arrays tracking scoring attributes.
 */
const findAllFeedbackForMentor = (mentorUserId) =>
    Feedback.find({ to: mentorUserId })
        .select("rating slotIndex from")
        .lean();

/**
 * Performance optimized pipeline computing mathematical rating metrics for dynamic tracking operations.
 * * @function computeMentorAvgRating
 * @param {any} mentorUserId - Target profile check argument criteria.
 * @returns {Promise<Array<{_id: any, avg: number, count: number}>>} Aggregation operation pipeline coordinates results.
 */
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

/**
 * Directly alters tracking descriptors storing average score values inside public profiles.
 * * @function updateMentorAvgRating
 * @param {any} mentorUserId - Target profile identifier reference key string.
 * @param {number} avgRating - Calculated floating-point average rating metric value.
 * @returns {Promise<Object|null>} Operational database response parameters validating status changes.
 */
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