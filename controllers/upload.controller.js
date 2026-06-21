// backend/controllers/upload.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");
const createUploadController = (uploadService, { logger }) => {
const uploadProfilePicture = async (req, res) => {
  try {
    const { body } = await uploadService.uploadProfilePicture({ file: req.file, user: req.user });
    return ok(res, body);
  } catch (err) {
    return handleError(res, err, "upload.uploadProfilePicture");
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
    return handleError(res, err, "upload.uploadVerificationDocuments");
  }
};

  return { uploadProfilePicture, uploadVerificationDocuments };
};
module.exports = createUploadController;