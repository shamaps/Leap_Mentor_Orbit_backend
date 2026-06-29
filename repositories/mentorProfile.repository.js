// repositories/mentorProfile.repository.js
const MentorProfile = require("../models/MentorProfile");

/**
 * Queries database engine layers to find an unpopulated raw profile row matching a user index.
 * * @function findProfileByUser
 * @param {any} userId - Target primary query index lookup search parameter.
 * @returns {Promise<Object|null>} Hydrated Mongoose document model blueprint tracker or null.
 */
const findProfileByUser = (userId) =>
    MentorProfile.findOne({ user: userId });

/**
 * Resolves a detailed mentor profile model populated with primary human account descriptors.
 * * @function findProfileByUserPopulated
 * @param {any} userId - Dynamic lookup identifier checking credentials indices.
 * @returns {Promise<Object|null>} Fully expanded model document row instance context mapping user details.
 */
const findProfileByUserPopulated = (userId) =>
    MentorProfile.findOne({ user: userId }).populate("user", "name email isEmailVerified");

/**
 * Commits a fresh structural mentor profile log document mapping properties.
 * * @function createProfile
 * @param {Object} data - Schema constraints verified configuration data variables.
 * @returns {Promise<Object>} Newly written database record model entry instance.
 */
const createProfile = (data) =>
    MentorProfile.create(data);

/**
 * Finds and executes in-place modifications over a single professional profile under verification rules.
 * * @function updateProfileByUser
 * @param {any} userId - Target modifier criteria reference index.
 * @param {Object} body - Verified validation parameters updates package container.
 * @returns {Promise<Object|null>} Fully mutated document layout returned confirmation model.
 */
const updateProfileByUser = (userId, body) =>
    MentorProfile.findOneAndUpdate(
        { user: userId },
        { $set: body },
        { new: true, runValidators: true }
    );

/**
 * High-performance populated public selection filtering out unpublished professional profiles.
 * * @function findPublicProfileByUser
 * @param {string} userId - Target identification selector string parameter.
 * @returns {Promise<Object|null>} Sanitized plain document representation data map, or null.
 */
const findPublicProfileByUser = (userId) =>
    MentorProfile.findOne({ user: userId, isProfilePublished: true }).populate(
        "user",
        "name email"
    );

module.exports = {
    findProfileByUser,
    findProfileByUserPopulated,
    createProfile,
    updateProfileByUser,
    findPublicProfileByUser,
};