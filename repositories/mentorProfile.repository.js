// repositories/mentorProfile.repository.js
const MentorProfile = require("../models/MentorProfile");

const findProfileByUser = (userId) =>
    MentorProfile.findOne({ user: userId });

const findProfileByUserPopulated = (userId) =>
    MentorProfile.findOne({ user: userId }).populate("user", "name email isEmailVerified");

const createProfile = (data) =>
    MentorProfile.create(data);

const updateProfileByUser = (userId, body) =>
    MentorProfile.findOneAndUpdate(
        { user: userId },
        { $set: body },
        { new: true, runValidators: true }
    );

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