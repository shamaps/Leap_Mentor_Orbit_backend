// controllers/menteeProfile.controller.js
const menteeProfileService = require("../services/menteeProfile.service");
const logger = require("../utils/logger");
const { handleError } = require("../utils/AppError");

// ── Local helper — eliminates the repeated catch pattern ─────
const catchError = (res, err, context) => {
  logger.error(`Unhandled error in menteeProfile.controller`, { error: err.message, stack: err.stack });
  return handleError(res, err, context);
};

const createProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.createProfile(req.user._id, req.body);
    logger.info("createProfile completed successfully");
    return res.status(201).json(data);
  } catch (err) {
    return catchError(res, err, "menteeProfile.createProfile");
  }
};

const getMyProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.getMyProfile(req.user._id);
    logger.info("getMyProfile completed successfully");
    return res.json(data);
  } catch (err) {
    // Special case: preserve isProfileComplete flag on 404
    if (err.statusCode === 404) {
      return res.status(404).json({ message: err.message, isProfileComplete: false });
    }
    return catchError(res, err, "menteeProfile.getMyProfile");
  }
};

const updateProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.updateProfile(req.user._id, req.body);
    logger.info("updateProfile completed successfully");
    return res.json(data);
  } catch (err) {
    return catchError(res, err, "menteeProfile.updateProfile");
  }
};

const getPublicProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.getPublicProfile(req.params.id);
    logger.info("getPublicProfile completed successfully");
    return res.json(data);
  } catch (err) {
    return catchError(res, err, "menteeProfile.getPublicProfile");
  }
};

module.exports = { createProfile, getMyProfile, updateProfile, getPublicProfile };