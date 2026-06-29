// backend/repositories/mentorSearch.repository.js
const MentorProfile = require("../models/MentorProfile");
const User = require("../models/User");
const { escapeRegex } = require("../utils/escapeRegex");

const MENTOR_SELECT =
    "user currentRole industry company skills hourlyRate avgRating profilePicture linkedInUrl portfolioUrl yearsOfExperience bio verificationStatus";

/**
 * Searches for mentor account rows by name using an Atlas index, with a case-insensitive regex query fallback path.
 * * @async
 * @function findMentorUsersByName
 * @param {string} name - Unfiltered name sequence criteria string.
 * @returns {Promise<Object[]>} Limited selection array containing matching user record identification blocks.
 */
const findMentorUsersByName = async (name) => {
    try {
        const results = await User.aggregate([
            {
                $search: {
                    index: "user_name_search",
                    compound: {
                        must: [
                            {
                                autocomplete: {
                                    query: name,
                                    path: "name",
                                    fuzzy: { maxEdits: 1 },
                                },
                            },
                        ],
                        filter: [
                            { equals: { path: "isDeleted", value: false } },
                        ],
                    },
                },
            },
            { $match: { roles: { $in: ["mentor"] } } },
            { $limit: 50 },
            { $project: { _id: 1 } },
        ]);
        return results;
    } catch {
        // Fallback to regex if Atlas user index not set up yet
        return User.find({
            name: { $regex: escapeRegex(name), $options: "i" },
            roles: { $in: ["mentor"] },
        }).select("_id").lean();
    }
};

/**
 * Calculates absolute count density configurations tracking active published profiles.
 * * @function countPublishedMentors
 * @returns {Promise<number>} Operational database total matching elements integers count.
 */
const countPublishedMentors = () =>
    MentorProfile.countDocuments({ isProfilePublished: true, isProfileComplete: true });

/**
 * Executes standard rating-sorted selections returning base profiles maps arrays slices.
 * * @function findPublishedMentors
 * @param {number} skip - Offset entry parameter indicating item ignore counts.
 * @param {number} limit - Structural window sizing parameters establishing range boundaries.
 * @returns {Promise<Object[]>} Plain JavaScript object dictionary arrays containing user details.
 */
const findPublishedMentors = (skip, limit) =>
    MentorProfile.find({ isProfilePublished: true, isProfileComplete: true })
        .populate("user", "name email")
        .select(MENTOR_SELECT)
        .sort({ avgRating: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

/**
 * Directly passes operational aggregation array layers context towards the base cluster execution blocks.
 * * @function runAtlasPipeline
 * @param {Object[]} pipeline - Compiled native MongoDB pipeline steps configurations array.
 * @returns {Promise<Object[]>} Aggregation output results array containing data indicators maps.
 */
const runAtlasPipeline = (pipeline) =>
    MentorProfile.aggregate(pipeline);

/**
 * Resolves missing profile details for specified users, combining secondary criteria filters like experience blocks.
 * * @function findProfilesByUserIds
 * @param {string[]} userIds - Unique account identification string entries indices collection array.
 * @param {Object} expMatch - Context variables configuration mapping range filters.
 * @returns {Promise<Object[]>} Collection array describing matched profile rows.
 */
const findProfilesByUserIds = (userIds, expMatch) =>
    MentorProfile.find({
        user: { $in: userIds },
        isProfilePublished: true,
        isProfileComplete: true,
        ...expMatch,
    })
        .populate("user", "name email")
        .select(MENTOR_SELECT)
        .lean();

/**
 * Resolves item density mapping count records matching backup query filters criteria.
 * * @function countByFilter
 * @param {Object} filter - Traditional Mongoose evaluation match statement block parameters.
 * @returns {Promise<number>} Operational count matching rows indicators.
 */
const countByFilter = (filter) =>
    MentorProfile.countDocuments(filter);

/**
 * Resolves rows configurations following regex checking patterns when Atlas index components drop links.
 * * @function findByFilter
 * @param {Object} filter - Traditional database check mapping statement configuration.
 * @param {number} skip - Pagination offset allocation indices parameter.
 * @param {number} limit - Capacity limit layout thickness tracker.
 * @returns {Promise<Object[]>} Rating sorted lean object rows details array collections.
 */
const findByFilter = (filter, skip, limit) =>
    MentorProfile.find(filter)
        .populate("user", "name email")
        .select(MENTOR_SELECT)
        .sort({ avgRating: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

module.exports = {
    findMentorUsersByName,
    countPublishedMentors,
    findPublishedMentors,
    runAtlasPipeline,
    findProfilesByUserIds,
    countByFilter,
    findByFilter,
};