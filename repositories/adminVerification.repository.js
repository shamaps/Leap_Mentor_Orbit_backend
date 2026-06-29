// repositories/adminVerification.repository.js
const MentorProfile = require("../models/MentorProfile.js");
const { findUsersByName } = require("./userSearch.repository");

/**
 * String projection listing selected fields required for mentor profile cards/lists.
 * @type {string}
 */
const MENTOR_LIST_SELECT =
    "user verificationStatus phoneNumber resumeDocument workExperienceDocuments " +
    "profilePicture bio skills currentRole company industry yearsOfExperience " +
    "languages averageRating totalSessions points";

/**
 * Finds user IDs for mentors matching a partial name or search term.
 * Restricts search exclusively to users with the "mentor" role and includes deleted profiles.
 * * @param {string} term - The search term or name to look up.
 * @returns {Promise<Array<string|import('mongoose').Types.ObjectId>>} An array of matched user IDs.
 */
const findMentorUserIdsByName = async (term) => {
    const users = await findUsersByName(term, { roles: ["mentor"], includeDeleted: true });
    return users.map((u) => u._id);
};

/**
 * Retrieves a paginated list of mentor profiles based on a query filter.
 * Populates basic user information and sorts by creation date in descending order.
 * * @param {Object} [filter={}] - MongoDB query filter object.
 * @param {number} [skip=0] - Number of profiles to skip for pagination.
 * @param {number} [limit=20] - Maximum number of profiles to return.
 * @returns {Promise<Array<Object>>} A promise resolving to an array of lean mentor profile objects.
 */
const findAllMentorProfiles = (filter = {}, skip = 0, limit = 20) =>
    MentorProfile.find(filter)
        .populate("user", "name email createdAt")
        .select(MENTOR_LIST_SELECT)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

/**
 * Counts the total number of mentor profiles matching a given filter.
 * * @param {Object} [filter={}] - MongoDB query filter object.
 * @returns {Promise<number>} Total document count matching the criteria.
 */
const countMentorProfiles = (filter = {}) => MentorProfile.countDocuments(filter);

/**
 * Finds a single mentor profile by its ID as a plain JavaScript object (lean).
 * Populates associated user credentials.
 * * @param {string|import('mongoose').Types.ObjectId} mentorProfileId - Unique ID of the mentor profile.
 * @returns {Promise<Object|null>} The mentor profile object, or null if not found.
 */
const findMentorProfileById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId)
        .populate("user", "name email createdAt")
        .lean();

/**
 * Finds a single mentor profile document instance by its ID (for mutations).
 * Populates specific user credentials.
 * * @param {string|import('mongoose').Types.ObjectId} mentorProfileId - Unique ID of the mentor profile.
 * @returns {import('mongoose').Document} Hydrated Mongoose document for the mentor profile.
 */
const findMentorProfileDocumentById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId).populate("user", "name email");

module.exports = {
    countMentorProfiles,
    findAllMentorProfiles,
    findMentorUserIdsByName,
    findMentorProfileById,
    findMentorProfileDocumentById,
};