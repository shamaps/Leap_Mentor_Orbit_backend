// controllers/menteeProfile.controller.js
const { ok, created, fail } = require("../utils/response");
const { handleError } = require("../utils/appError");
const createMenteeProfileController = (menteeProfileService, { logger }) => {
// ── Local helper — eliminates the repeated catch pattern ─────
const catchError = (res, err, context) => {
  logger.error(`Unhandled error in menteeProfile.controller`, { error: err.message, stack: err.stack });
  return handleError(res, err, context);
};

const createProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.createProfile(req.user._id, req.body);
    logger.info("createProfile completed successfully");
    return created(res, data);
  } catch (err) {
    if (err.statusCode === 409) {
      return res.status(409).json({ message: err.message });
    }
    return catchError(res, err, "menteeProfile.createProfile");
  }
};

const getMyProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.getMyProfile(req.user._id);
    logger.info("getMyProfile completed successfully");
    return ok(res, data);
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
    return ok(res, data);
  } catch (err) {
    return catchError(res, err, "menteeProfile.updateProfile");
  }
};

const getPublicProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.getPublicProfile(req.params.id);
    logger.info("getPublicProfile completed successfully");
    return ok(res, data);
  } catch (err) {
    return catchError(res, err, "menteeProfile.getPublicProfile");
  }
};

  return { createProfile, getMyProfile, updateProfile, getPublicProfile };
};
module.exports = createMenteeProfileController;