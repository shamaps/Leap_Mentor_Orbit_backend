// repositories/menteeProfile.repository.js
const MenteeProfile = require("../models/MenteeProfile");

const findProfileByUser = (userId) =>
    MenteeProfile.findOne({ user: userId });

const findProfileByUserPopulated = (userId) =>
    MenteeProfile.findOne({ user: userId }).populate("user", "name email isEmailVerified");

const createProfile = (data) =>
    MenteeProfile.create(data);

const updateProfileByUser = (userId, body) =>
    MenteeProfile.findOneAndUpdate(
        { user: userId },
        { $set: body },
        { new: true, runValidators: true }
    );

const findPublicProfileByUser = (userId) =>
    MenteeProfile.findOne({ user: userId, isProfilePublished: true }).populate(
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