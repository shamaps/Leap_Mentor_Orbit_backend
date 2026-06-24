// repositories/adminVerification.repository.js
const MentorProfile = require("../models/MentorProfile.js");
const { findUsersByName } = require("./userSearch.repository");

const MENTOR_LIST_SELECT =
    "user verificationStatus phoneNumber resumeDocument workExperienceDocuments " +
    "profilePicture bio skills currentRole company industry yearsOfExperience " +
    "languages averageRating totalSessions points";

// Atlas name search restricted to users with the "mentor" role,
// since verification only ever applies to mentors.
const findMentorUserIdsByName = async (term) => {
    const users = await findUsersByName(term, { roles: ["mentor"], includeDeleted: true });
    return users.map((u) => u._id);
};

const findAllMentorProfiles = (filter = {}, skip = 0, limit = 20) =>
    MentorProfile.find(filter)
        .populate("user", "name email createdAt")
        .select(MENTOR_LIST_SELECT)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

const countMentorProfiles = (filter = {}) => MentorProfile.countDocuments(filter);
const findMentorProfileById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId)
        .populate("user", "name email createdAt")
        .lean();

const findMentorProfileDocumentById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId).populate("user", "name email");

module.exports = {
    countMentorProfiles,
    findAllMentorProfiles,
    findMentorUserIdsByName,
    findMentorProfileById,
    findMentorProfileDocumentById,
};