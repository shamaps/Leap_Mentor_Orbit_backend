// controllers/mentorProfile.controller.js
const { ok, created } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} MentorProfileService
 * @property {(userId: any, body: Object) => Promise<Object>} createProfile - Logic processing initial profile creations.
 * @property {(userId: any) => Promise<Object>} getMyProfile - Logic collecting internal session profile parameters.
 * @property {(userId: any, body: Object) => Promise<Object>} updateProfile - Logic applying modifications over profile records.
 * @property {(id: string) => Promise<Object>} getPublicProfile - Logic extracting sanitized public fields.
 */

/**
 * Factory assembling presentation entry controllers handling HTTP routing constraints for profiles.
 * * @param {MentorProfileService} mentorProfileService - Core execution handler service orchestrating profile parameters.
 * @param {{ logger: Logger }} dependencies - Performance trace logger facility tracking runtime context variables.
 * @returns {Object} Grouped controller routes callback actions container mapping.
 */
const createMentorProfileController = (mentorProfileService, { logger }) => {
  /**
   * POST /api/mentor-profile
   * Express Route Handler receiving payload criteria values to write a new mentor profile record.
   * * @async
   * @function createProfile
   * @param {import('express').Request} req - Intake request frame context holding parameter metrics body.
   * @param {import('express').Response} res - Standard outbound communication connection wrapper pipeline.
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
   * Express Route Handler rendering open profiles structures matching active secure professional users.
   * * @async
   * @function getMyProfile
   * @param {import('express').Request} req - Input request message envelope parsing token indices.
   * @param {import('express').Response} res - Standard connection output response transport pipe layer.
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
   * Express Route Handler directing updates to update existing professional profile components data rows.
   * * @async
   * @function updateProfile
   * @param {import('express').Request} req - Route context state container specifying target indices and modifications.
   * @param {import('express').Response} res - Execution transport return link interface adapter socket pipeline.
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
   * Express Route Handler parsing primary target path fields to map sanitized public professional profile details.
   * * @async
   * @function getPublicProfile
   * @param {import('express').Request} req - Route context request envelope containing parameter paths parameters.
   * @param {import('express').Response} res - Dispatched output data transport response channel connection wrapper.
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