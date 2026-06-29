// controllers/verification.controller.js
const { handleError } = require("../utils/appError");
const { ok, fail } = require("../utils/response");

/**
 * @typedef {Object} VerificationService
 * @property {(context: Object) => Promise<{ status: number, body: Object }>} sendVerification - Services logic processing initial token distributions.
 * @property {(context: Object) => Promise<{ status: number, body: Object }>} resendVerification - Services logic handling lifecycle token re-transmissions.
 * @property {(options: Object) => Promise<{ status: number, body: Object }>} verifyOtp - Services logic evaluating matching passcode inputs parameters.
 * @property {(parameters: Object) => Promise<{ status: number, body: Object }>} verifyLink - Services logic analyzing cryptographic link tokens.
 */

/**
 * Factory assembling presentation entry controllers layer handling HTTP email authentication variables.
 * * @param {VerificationService} verificationService - Underlying core verification worker service layer instance.
 * @param {{ logger: Object }} dependencies - Metric tracking and application performance logging analytics capture tool.
 * @returns {Object} Grouped controller routes callback actions container mapping blueprint.
 */
const createVerificationController = (verificationService, { logger }) => {

  /**
   * Express Route Handler reading email attributes from body elements to trigger outbound verification cycles.
   * * @async
   * @function sendVerification
   * @param {import('express').Request} req - Intake framework request parsing body properties metrics.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket channel.
   */
  const sendVerification = async (req, res) => {
    try {
      const { status, body } = await verificationService.sendVerification({ email: req.body.email });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.sendVerification");
    }
  };

  /**
   * Express Route Handler processing email attributes to re-issue unexpired verification criteria data pools.
   * * @async
   * @function resendVerification
   * @param {import('express').Request} req - Interaction request frame context tracking input fields attributes.
   * @param {import('express').Response} res - Dispatched execution transport return link interface socket pipeline.
   */
  const resendVerification = async (req, res) => {
    try {
      const { status, body } = await verificationService.resendVerification({ email: req.body.email });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.resendVerification");
    }
  };

  /**
   * Express Route Handler analyzing submitted passcode strings to unlock email verification milestones.
   * * @async
   * @function verifyOtp
   * @param {import('express').Request} req - Route context parameter request object holding passcode payload parameters.
   * @param {import('express').Response} res - Structural payload interface output return connector transport.
   */
  const verifyOtp = async (req, res) => {
    try {
      const { email, otp } = req.body;
      const { status, body } = await verificationService.verifyOtp({ email, otp });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.verifyOtp");
    }
  };

  /**
   * Express Route Handler parsing URL route parameters and query segments to authorize security magic links.
   * * @async
   * @function verifyLink
   * @param {import('express').Request} req - Express request envelope parsing path parameters variables and search parameters.
   * @param {import('express').Response} res - Direct success returning transport adapter pipe channel closure.
   */
  const verifyLink = async (req, res) => {
    try {
      const { token } = req.params;
      const { email } = req.query;
      const { status, body } = await verificationService.verifyLink({ token, email });
      return status === 200 ? ok(res, body) : fail(res, body.message, status);
    } catch (err) {
      return handleError(res, err, "verification.verifyLink");
    }
  };

  return { sendVerification, resendVerification, verifyOtp, verifyLink };
};

module.exports = createVerificationController;