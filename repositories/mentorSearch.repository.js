// backend/repositories/mentorSearch.repository.js
const MentorProfile = require("../models/MentorProfile");
const User = require("../models/User");
const { escapeRegex } = require("../utils/escapeRegex");

const MENTOR_SELECT =
    "user currentRole industry company skills hourlyRate avgRating profilePicture linkedInUrl portfolioUrl yearsOfExperience bio verificationStatus";

// ── Name search via Atlas (user_name_search index on users collection) ──────
// Falls back to $regex if user_name_search index doesn't exist yet
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

// ── Plain list (no query, no filters) ───────────────────────────────────────
const countPublishedMentors = () =>
    MentorProfile.countDocuments({ isProfilePublished: true, isProfileComplete: true });

const findPublishedMentors = (skip, limit) =>
    MentorProfile.find({ isProfilePublished: true, isProfileComplete: true })
        .populate("user", "name email")
        .select(MENTOR_SELECT)
        .sort({ avgRating: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

// ── Atlas Search pipeline runner ─────────────────────────────────────────────
const runAtlasPipeline = (pipeline) =>
    MentorProfile.aggregate(pipeline);

// ── Name-match union (profiles Atlas missed because name is on User) ─────────
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

// ── Fallback (regex — used when Atlas is unavailable) ───────────────────────
const countByFilter = (filter) =>
    MentorProfile.countDocuments(filter);

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