// controllers/upload.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} UploadService
 * @property {(params: { file: Object, user: Object }) => Promise<{ status: number, body: Object }>} uploadProfilePicture - Processes avatar updates.
 * @property {(params: { phoneNumber: string, resumeFile: Object, workExperienceFiles: Object[], user: Object }) => Promise<{ status: number, body: Object }>} uploadVerificationDocuments - Processes core credentials applications.
 */

/**
 * Factory assembling presentation layer controller hooks mapping HTTP file routing boundaries.
 * * @param {UploadService} uploadService - Core single file and bulk attachment validation service instance.
 * @param {{ logger: Object }} dependencies - Metric tracking and application performance logging telemetry tool.
 * @returns {Object} Grouped controller endpoints route callback actions map container.
 */
const createUploadController = (uploadService, { logger }) => {
  /**
   * Express Route Handler receiving dynamic image payloads to rewrite user avatar profiles rows.
   * * @async
   * @function uploadProfilePicture
   * @param {import('express').Request & { file: Object }} req - Intake framework request parsing body properties and file buffer targets.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket channel.
   */
  const uploadProfilePicture = async (req, res) => {
    try {
      const { body } = await uploadService.uploadProfilePicture({ file: req.file, user: req.user });
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "upload.uploadProfilePicture");
    }
  };

  /**
   * Express Route Handler reading multi-field form data packages containing dynamic certificates array streams.
   * * @async
   * @function uploadVerificationDocuments
   * @param {import('express').Request & { files?: { resume?: Object[], workExperienceDocs?: Object[] } }} req - Route query boundary definitions container payload.
   * @param {import('express').Response} res - Dispatched output data transport response channel socket connection wrapper.
   */
  const uploadVerificationDocuments = async (req, res) => {
    try {
      const { body } = await uploadService.uploadVerificationDocuments({
        phoneNumber: req.body.phoneNumber,
        resumeFile: req.files?.resume?.[0],
        workExperienceFiles: req.files?.workExperienceDocs || [],
        user: req.user,
      });
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "upload.uploadVerificationDocuments");
    }
  };

  return { uploadProfilePicture, uploadVerificationDocuments };
};

module.exports = createUploadController;