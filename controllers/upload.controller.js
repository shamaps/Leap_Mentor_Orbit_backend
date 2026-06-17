// backend/controllers/upload.controller.js
const uploadService = require("../services/upload.service");
const logger = require("../utils/logger");
const { ok, fail } = require("../utils/response");

const uploadProfilePicture = async (req, res) => {
  try {
    const {  body } = await uploadService.uploadProfilePicture({ file: req.file });
    return ok(res, body);
  } catch (err) {
    logger.error("❌ uploadProfilePicture error:", err.message);
    return fail(res, "Failed to upload image.", 500);
  }
};

const uploadVerificationDocuments = async (req, res) => {
  try {
    const { body } = await uploadService.uploadVerificationDocuments({
      phoneNumber: req.body.phoneNumber,
      resumeFile: req.files?.resume?.[0],
      workExperienceFiles: req.files?.workExperienceDocs || [],
      user: req.user,
    });
    return ok(res, body);
  } catch (err) {
    logger.error("❌ uploadVerificationDocuments error:", err.message);
    return fail(res, "Failed to upload documents.", 500);
  }
};

module.exports = { uploadProfilePicture, uploadVerificationDocuments };