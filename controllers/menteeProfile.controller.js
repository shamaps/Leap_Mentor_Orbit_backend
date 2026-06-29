// controllers/menteeProfile.controller.js
const { ok, created } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} MenteeProfileService
 * @property {(userId: any, body: Object) => Promise<Object>} createProfile - Logic processing initial profile creations.
 * @property {(userId: any) => Promise<Object>} getMyProfile - Logic collecting internal session profile indicators.
 * @property {(userId: any, body: Object) => Promise<Object>} updateProfile - Logic applying modifications over records fields.
 * @property {(id: string) => Promise<Object>} getPublicProfile - Logic extracting sanitized public fields.
 */

/**
 * Factory assembling presentation entry controllers handling HTTP routing constraints for profiles.
 * * @param {MenteeProfileService} menteeProfileService - Core execution handler service orchestrating operational steps.
 * @param {{ logger: Logger }} dependencies - Performance trace logger facility tracking runtime context variables.
 * @returns {Object} Grouped controller routes callback actions container mapping.
 */
const createMenteeProfileController = (menteeProfileService, { logger }) => {

  /**
   * Express Route Handler receiving dynamic payload values to write a new mentee profile record.
   * * @async
   * @function createProfile
   * @param {import('express').Request} req - Intake request frame context holding parameter metrics body.
   * @param {import('express').Response} res - Standard outbound communication connection wrapper pipeline.
   */
  const createProfile = async (req, res) => {
    try {
      const data = await menteeProfileService.createProfile(req.user._id, req.body);
      logger.info("createProfile completed successfully");
      return created(res, data);
    } catch (err) {
      return handleError(res, err, "menteeProfile.createProfile");
    }
  };

  /**
   * Express Route Handler rendering open profiles structures matching active secure users.
   * * @async
   * @function getMyProfile
   * @param {import('express').Request} req - Input request message envelope parsing token indices.
   * @param {import('express').Response} res - Standard connection output response transport pipe layer.
   */
  const getMyProfile = async (req, res) => {
    try {
      const data = await menteeProfileService.getMyProfile(req.user._id);
      logger.info("getMyProfile completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "menteeProfile.getMyProfile");
    }
  };

  /**
   * Express Route Handler directing inputs to update existing user profile components data rows.
   * * @async
   * @function updateProfile
   * @param {import('express').Request} req - Route context state container specifying target indices and values.
   * @param {import('express').Response} res - Execution transport return link interface adapter socket pipeline.
   */
  const updateProfile = async (req, res) => {
    try {
      const data = await menteeProfileService.updateProfile(req.user._id, req.body);
      logger.info("updateProfile completed successfully");
      return ok(res, data);
    } catch (err) { return handleError(res, err, "menteeProfile.updateProfile"); }
  };

  /**
   * Express Route Handler parsing primary target path fields to map sanitized public profile details.
   * * @async
   * @function getPublicProfile
   * @param {import('express').Request} req - Route context request envelope containing parameter paths parameters.
   * @param {import('express').Response} res - Dispatched output data transport response channel connection wrapper.
   */
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