// backend/repositories/mentorSearch.repository.js
const MentorProfile = require("../models/MentorProfile");
const User = require("../models/User");
const { escapeRegex } = require("../utils/escapeRegex");
const MENTOR_SELECT =
    "user currentRole industry company skills hourlyRate avgRating profilePicture linkedInUrl portfolioUrl yearsOfExperience bio verificationStatus";

// USER

const findMentorUsersByName = (name) =>
    User.find({
        name: { $regex: escapeRegex(name), $options: "i" },
        roles: { $in: ["mentor"] },
    })
        .select("_id")
        .lean();

// PLAIN LIST (no query, no filters)

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

// ATLAS SEARCH

const runAtlasPipeline = (pipeline) =>
    MentorProfile.aggregate(pipeline);
// NAME-MATCH UNION (extra profiles not returned by Atlas)
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

// FALLBACK (regex — used when Atlas is unavailable)

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