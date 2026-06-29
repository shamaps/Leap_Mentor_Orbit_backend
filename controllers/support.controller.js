// controllers/support.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} SupportService
 * @property {(payload: Object) => Promise<{ status: number, body: Object }>} createMessage - Logic checking and saving fresh support logs entries.
 * @property {(options: Object) => Promise<{ status: number, body: Object }>} getMessages - Logic compiling historical tickets dashboard matrices.
 * @property {(id: string) => Promise<{ status: number, body: Object }>} resolveMessage - Logic processing target ticket closure states.
 */

/**
 * Factory assembling presentation controller handlers processing user support parameters for HTTP routing.
 * * @param {SupportService} supportService - Core customer relationship ticket service worker module instance.
 * @param {{ logger: Logger }} dependencies - Performance trace logger analytics diagnostics parameters wrapper.
 * @returns {Object} Grouped controller routes callback actions container mapping blueprint.
 */
const createSupportController = (supportService, { logger }) => {

  /**
   * Express Route Handler receiving text payload parameters to write an inbound support message entry.
   * * @async
   * @function createMessage
   * @param {import('express').Request} req - Intake framework request parsing body attributes parameters metrics.
   * @param {import('express').Response} res - Standard outbound data response transport connector pipeline socket.
   */
  const createMessage = async (req, res) => {
    try {
      const { email, subject, message, role } = req.body;
      const { body } = await supportService.createMessage({ email, subject, message, role });
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "support.createMessage");
    }
  };

  /**
   * Express Route Handler rendering complete records listings tracking historical logged help entries.
   * * @async
   * @function getMessages
   * @param {import('express').Request} req - Route context parameter request object holding limit parameters query strings.
   * @param {import('express').Response} res - Dispatched query overview data transport response channel socket.
   */
  const getMessages = async (req, res) => {
    try {
      const { body } = await supportService.getMessages({
        page: req.query.page,
        limit: req.query.limit,
      });
      logger.info("getMessages completed successfully");
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "support.getMessages");
    }
  };

  /**
   * Express Route Handler directing specific path parameters keys to mark custom tickets resolved.
   * * @async
   * @function resolveMessage
   * @param {import('express').Request} req - Express request envelope containing path selectors query parameters.
   * @param {import('express').Response} res - Structural payload interface output return connector.
   */
  const resolveMessage = async (req, res) => {
    try {
      const { body } = await supportService.resolveMessage(req.params.id);
      return ok(res, body);
    } catch (err) {
      return handleError(res, err, "support.resolveMessage");
    }
  };

  return { createMessage, getMessages, resolveMessage };
};

module.exports = createSupportController;