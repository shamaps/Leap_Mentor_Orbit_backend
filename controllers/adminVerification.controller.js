// controllers/adminVerification.controller.js
const adminVerificationService = require("../services/adminVerification.service");

const { logger } = require("@sentry/node");
const handleError = (res, err, context) => {
  logger.error(`[adminVerification] ${context}:`, err);
  return res.status(err.statusCode || 500).json({ message: err.message });
};

const getAllMentorVerifications = async (req, res) => {
  try {
    const data = await adminVerificationService.getAllMentorVerifications();
    logger.info("getAllMentorVerifications completed successfully");
    return res.status(200).json(data);
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
    return res.status(200).json(data);
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
    return res.status(200).json(data);
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
    return res.status(200).json(data);
  } catch (err) {
    logger.error("Unhandled error in adminVerification.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "revokeMentorVerification");
  }
};

module.exports = {
  getAllMentorVerifications,
  getMentorVerificationById,
  verifyMentor,
  revokeMentorVerification,
};