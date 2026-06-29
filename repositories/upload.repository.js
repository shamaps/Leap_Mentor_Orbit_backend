// repositories/upload.repository.js
const MentorProfile = require("../models/MentorProfile");

/**
 * Atomic processing updates adding verification metadata nodes to an existing professional profile document row.
 * * @function updateMentorProfileDocuments
 * @param {any} userId - Target primary account locator checking profile user keys.
 * @param {Object} data - Verified parameter indicators container payload packaging fields.
 * @param {string} data.phoneNumber - Trimmed professional phone number criteria.
 * @param {CloudinaryAssetDocument} data.resumeDocument - Formatted asset link describing stored resume variables.
 * @param {CloudinaryAssetDocument[]} data.workExperienceDocuments - Collection grouping supporting credentials objects.
 * @param {string} data.verificationStatus - Current active moderation lifecycle classification code ("pending").
 * @returns {import('mongoose').Query} The updated mentor profile database model document record context layout.
 */
const updateMentorProfileDocuments = (userId, data) =>
    MentorProfile.findOneAndUpdate({ user: userId }, data, { new: true });

module.exports = {
    updateMentorProfileDocuments,
};