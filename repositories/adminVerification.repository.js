// repositories/adminVerification.repository.js
const MentorProfile = require("../models/MentorProfile.js");

const MENTOR_LIST_SELECT =
    "user verificationStatus phoneNumber resumeDocument workExperienceDocuments " +
    "profilePicture bio skills currentRole company industry yearsOfExperience " +
    "languages averageRating totalSessions points";

const findAllMentorProfiles = () =>
    MentorProfile.find({})
        .populate("user", "name email createdAt")
        .select(MENTOR_LIST_SELECT)
        .sort({ createdAt: -1 })
        .lean();

const findMentorProfileById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId)
        .populate("user", "name email createdAt")
        .lean();

const findMentorProfileDocumentById = (mentorProfileId) =>
    MentorProfile.findById(mentorProfileId).populate("user", "name email");

module.exports = {
    findAllMentorProfiles,
    findMentorProfileById,
    findMentorProfileDocumentById,
};