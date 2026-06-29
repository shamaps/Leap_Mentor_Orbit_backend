// controllers/adminVerification.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * Factory function to create the Admin Verification Controller.
 * @param {Object} adminVerificationService - The domain service handling verification logic.
 * @param {Object} dependencies - Core system dependencies.
 * @param {Object} dependencies.logger - Application logger object.
 * @returns {Object} Admin verification controller handlers.
 */
const createAdminVerificationController = (adminVerificationService, { logger }) => {
  /**
   * Retrieves a paginated list of all mentor verification requests.
   * @param {Object} req - Express request object.
   * @param {Object} req.query - Query string parameters.
   * @param {string} [req.query.page] - Page number for pagination.
   * @param {string} [req.query.limit] - Record limit per page.
   * @param {string} [req.query.search] - Search term for filtering by name.
   * @param {Object} res - Express response object.
   * @returns {Promise<Object>} JSON response envelope with data or error.
   */
  const getAllMentorVerifications = async (req, res) => {
    try {
      const data = await adminVerificationService.getAllMentorVerifications({
        page: req.query.page,
        limit: req.query.limit,
        search: req.query.search,
      });
      logger.info("getAllMentorVerifications completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getAllMentorVerifications");
    }
  };

  /**
   * Retrieves detail for a single mentor verification request by profile ID.
   * @param {Object} req - Express request object.
   * @param {Object} req.params - URL route parameters.
   * @param {string} req.params.mentorProfileId - The ID of the mentor profile to retrieve.
   * @param {Object} res - Express response object.
   * @returns {Promise<Object>} JSON response envelope with data or error.
   */
  const getMentorVerificationById = async (req, res) => {
    try {
      const data = await adminVerificationService.getMentorVerificationById(
        req.params.mentorProfileId
      );
      logger.info("getMentorVerificationById completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "getMentorVerificationById");
    }
  };

  /**
   * Verifies a mentor profile.
   * @param {Object} req - Express request object.
   * @param {Object} req.params - URL route parameters.
   * @param {string} req.params.mentorProfileId - The ID of the mentor profile to verify.
   * @param {Object} res - Express response object.
   * @returns {Promise<Object>} JSON response envelope with confirmation or error.
   */
  const verifyMentor = async (req, res) => {
    try {
      const data = await adminVerificationService.verifyMentor(
        req.params.mentorProfileId
      );
      logger.info("verifyMentor completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "verifyMentor");
    }
  };

  /**
   * Revokes an existing verification from a mentor profile.
   * @param {Object} req - Express request object.
   * @param {Object} req.params - URL route parameters.
   * @param {string} req.params.mentorProfileId - The ID of the mentor profile to revoke.
   * @param {Object} res - Express response object.
   * @returns {Promise<Object>} JSON response envelope with confirmation or error.
   */
  const revokeMentorVerification = async (req, res) => {
    try {
      const data = await adminVerificationService.revokeMentorVerification(
        req.params.mentorProfileId
      );
      logger.info("revokeMentorVerification completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "revokeMentorVerification");
    }
  };

  return { getAllMentorVerifications, getMentorVerificationById, verifyMentor, revokeMentorVerification };
};

module.exports = createAdminVerificationController;