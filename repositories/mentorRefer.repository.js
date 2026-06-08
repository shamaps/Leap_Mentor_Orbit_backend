// repositories/mentorRefer.repository.js
const MentorProfile = require("../models/MentorProfile");
const ConnectRequest = require("../models/ConnectRequest");

const findRequestWithMentor = (id) =>
    ConnectRequest.findById(id).populate("mentor", "_id");

const findMyProfileSkills = (userId) =>
    MentorProfile.findOne({ user: userId }).select("skills industry");

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