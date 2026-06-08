const MentorProfile = require("../models/MentorProfile");

const updateMentorProfileDocuments = (userId, data) =>
    MentorProfile.findOneAndUpdate({ user: userId }, data, { new: true });

module.exports = {
    updateMentorProfileDocuments,
};