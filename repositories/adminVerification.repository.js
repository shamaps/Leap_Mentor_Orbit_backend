// repositories/adminVerification.repository.js
const MentorProfile = require("../models/MentorProfile.js");

const MENTOR_LIST_SELECT =
    "user verificationStatus phoneNumber resumeDocument workExperienceDocuments " +
    "profilePicture bio skills currentRole company industry yearsOfExperience " +
    "languages averageRating totalSessions points";

const findAllMentorProfiles = (skip = 0, limit = 20) =>
    MentorProfile.find({})
        .populate("user", "name email createdAt")
        .select(MENTOR_LIST_SELECT)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

const countMentorProfiles = () => MentorProfile.countDocuments({});
const findMentorProfileById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId)
        .populate("user", "name email createdAt")
        .lean();

const findMentorProfileDocumentById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId).populate("user", "name email");

module.exports = {
    countMentorProfiles,
    findAllMentorProfiles,
    findMentorProfileById,
    findMentorProfileDocumentById,
};