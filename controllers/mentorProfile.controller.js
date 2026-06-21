// controllers/mentorProfile.controller.js
const { ok, created } = require("../utils/response");
const { handleError } = require("../utils/appError");
const createMentorProfileController = (mentorProfileService, { logger }) => {
/**
 * POST /api/mentor-profile
 */
const createProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.createProfile(req.user._id, req.body);
    logger.info("createProfile completed successfully");
    return created(res, data);
  } catch (err) {
    return handleError(res, err, "mentorProfile.createProfile");
  }
};

/**
 * GET /api/mentor-profile/me
 */
const getMyProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.getMyProfile(req.user._id);
    logger.info("getMyProfile completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "mentorProfile.getMyProfile");
  }
};

/**
 * PUT /api/mentor-profile/me
 */
const updateProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.updateProfile(req.user._id, req.body);
    logger.info("updateProfile completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "mentorProfile.updateProfile");
  }
};

/**
 * GET /api/mentor-profile/:id
 */
const getPublicProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.getPublicProfile(req.params.id);
    logger.info("getPublicProfile completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "mentorProfile.getPublicProfile");
  }
};

  return { createProfile, getMyProfile, updateProfile, getPublicProfile };
};
module.exports = createMentorProfileController;