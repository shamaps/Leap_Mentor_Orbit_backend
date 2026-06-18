// controllers/adminVerification.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");
const createAdminVerificationController = (adminVerificationService, { logger }) => {
const getAllMentorVerifications = async (req, res) => {
  try {
    const data = await adminVerificationService.getAllMentorVerifications();
    logger.info("getAllMentorVerifications completed successfully");
    return ok(res, data);
  } catch (err) {
    logger.error("Unhandled error in adminVerification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getAllMentorVerifications");
  }
};

const getMentorVerificationById = async (req, res) => {
  try {
    const data = await adminVerificationService.getMentorVerificationById(
      req.params.mentorProfileId
    );
    logger.info("getMentorVerificationById completed successfully");
    return ok(res, data);
  } catch (err) {
    logger.error("Unhandled error in adminVerification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "getMentorVerificationById");
  }
};

const verifyMentor = async (req, res) => {
  try {
    const data = await adminVerificationService.verifyMentor(
      req.params.mentorProfileId
    );
    logger.info("verifyMentor completed successfully");
    return ok(res, data);
  } catch (err) {
    logger.error("Unhandled error in adminVerification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "verifyMentor");
  }
};

const revokeMentorVerification = async (req, res) => {
  try {
    const data = await adminVerificationService.revokeMentorVerification(
      req.params.mentorProfileId
    );
    logger.info("revokeMentorVerification completed successfully");
    return ok(res, data);
  } catch (err) {
    logger.error("Unhandled error in adminVerification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "revokeMentorVerification");
  }
};

  return { getAllMentorVerifications, getMentorVerificationById, verifyMentor, revokeMentorVerification };
};
module.exports = createAdminVerificationController;