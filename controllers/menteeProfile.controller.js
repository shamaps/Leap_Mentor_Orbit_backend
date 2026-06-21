// controllers/menteeProfile.controller.js
const { ok, created } = require("../utils/response");
const { handleError } = require("../utils/appError");
const createMenteeProfileController = (menteeProfileService, { logger }) => {

const createProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.createProfile(req.user._id, req.body);
    logger.info("createProfile completed successfully");
    return created(res, data);
  } catch (err) {
    return handleError(res, err, "menteeProfile.createProfile");
  }
};

const getMyProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.getMyProfile(req.user._id);
    logger.info("getMyProfile completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "menteeProfile.getMyProfile");
  }
};

const updateProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.updateProfile(req.user._id, req.body);
    logger.info("updateProfile completed successfully");
    return ok(res, data);
  } catch (err) { return handleError(res, err, "menteeProfile.updateProfile"); }
};

const getPublicProfile = async (req, res) => {
  try {
    const data = await menteeProfileService.getPublicProfile(req.params.id);
    logger.info("getPublicProfile completed successfully");
    return ok(res, data);
  } catch (err) { return handleError(res, err, "menteeProfile.getPublicProfile"); }
};

  return { createProfile, getMyProfile, updateProfile, getPublicProfile };
};
module.exports = createMenteeProfileController;