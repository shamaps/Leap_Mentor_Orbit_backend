// controllers/mentorProfile.controller.js
const mentorProfileService = require("../services/mentorProfile.service");

const { logger } = require("@sentry/node");
const handleError = (res, err) =>
  res.status(err.statusCode || 500).json({ message: err.message });

/**
 * POST /api/mentor-profile
 */
const createProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.createProfile(req.user._id, req.body);
    logger.info("createProfile completed successfully");
    return res.status(201).json(data);
  } catch (err) {
    logger.error("Unhandled error in mentorProfile.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

/**
 * GET /api/mentor-profile/me
 */
const getMyProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.getMyProfile(req.user._id);
    logger.info("getMyProfile completed successfully");
    return res.json(data);
  } catch (err) {
    // Preserve the isProfileComplete: false field from the original 404 response
    if (err.statusCode === 404) {
      return res.status(404).json({ message: err.message, isProfileComplete: false });
    }
    logger.error("Unhandled error in mentorProfile.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

/**
 * PUT /api/mentor-profile/me
 */
const updateProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.updateProfile(req.user._id, req.body);
    logger.info("updateProfile completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in mentorProfile.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

/**
 * GET /api/mentor-profile/:id
 */
const getPublicProfile = async (req, res) => {
  try {
    const data = await mentorProfileService.getPublicProfile(req.params.id);
    logger.info("getPublicProfile completed successfully");
    return res.json(data);
  } catch (err) {
    logger.error("Unhandled error in mentorProfile.controller", { error: err.message, stack: err.stack });
    return handleError(res, err);
  }
};

module.exports = {
  createProfile,
  getMyProfile,
  updateProfile,
  getPublicProfile,
};