// repositories/mentorRefer.repository.js
const MentorProfile = require("../models/MentorProfile");
const ConnectRequest = require("../models/ConnectRequest");

/**
 * Pulls summary information for a request, selecting the assigned mentor field metadata.
 * * @function findRequestWithMentor
 * @param {string} id - Database row locator primary index string.
 * @returns {Promise<Object|null>} Lean document representation context layout, or null.
 */
const findRequestWithMentor = (id) =>
    ConnectRequest.findById(id)
        .select("mentor status")
        .populate("mentor", "_id")
        .lean();

/**
 * Extracts compact profile capabilities and industry indicators for the performing mentor.
 * * @function findMyProfileSkills
 * @param {any} userId - Core session user reference identifier checking credentials.
 * @returns {Promise<Object|null>} Lean data collection containing skills and industry labels, or null.
 */
const findMyProfileSkills = (userId) =>
    MentorProfile.findOne({ user: userId })
        .select("skills industry")
        .lean();

/**
 * Queries active, complete, and published mentor profiles sharing matching skill intersection parameters.
 * Limits the final response array slice thickness to 20 documents.
 * * @function findSimilarMentors
 * @param {any} userId - Performing host identifier key excluded from comparison sets.
 * @param {string[]} skills - Array containing keyword tags used for the intersection check.
 * @returns {Promise<Object[]>} Plain JavaScript object representations matching the criteria.
 */
const findSimilarMentors = (userId, skills) =>
    MentorProfile.find({
        user: { $ne: userId },
        isProfilePublished: true,
        isProfileComplete: true,
        skills: { $in: skills },
    })
        .populate("user", "name email")
        .select("user currentRole company skills profilePicture avgRating industry hourlyRate")
        .limit(20)
        .lean();

module.exports = {
    findRequestWithMentor,
    findMyProfileSkills,
    findSimilarMentors,
};