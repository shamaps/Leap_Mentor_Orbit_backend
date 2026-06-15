// backend/controllers/upload.controller.js
const uploadService = require("../services/upload.service");
const logger = require("../utils/logger");

const uploadProfilePicture = async (req, res) => {
  try {
    const { status, body } = await uploadService.uploadProfilePicture({ file: req.file });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("❌ uploadProfilePicture error:", err.message);
    return res.status(500).json({ message: "Failed to upload image." });
  }
};

const uploadVerificationDocuments = async (req, res) => {
  try {
    const { status, body } = await uploadService.uploadVerificationDocuments({
      phoneNumber: req.body.phoneNumber,
      resumeFile: req.files?.resume?.[0],
      workExperienceFiles: req.files?.workExperienceDocs || [],
      user: req.user,
    });
    return res.status(status).json(body);
  } catch (err) {
    logger.error("❌ uploadVerificationDocuments error:", err.message);
    return res.status(500).json({ message: "Failed to upload documents." });
  }
};

module.exports = { uploadProfilePicture, uploadVerificationDocuments };