// utils/AppError.js

const logger = require("./logger");
class AppError extends Error {
  constructor(status, message, meta = {}) {
    super(message);
    this.status = status;
    this.message = message;
    this.name = "AppError";
    this.meta = meta;
    this.isOperational = true; 
  }
}

/**
 * Shared controller error handler. Replaces local handleError definitions.
 *
 * - AppError (expected, user-facing): logs as warn, returns the thrown status
 * - Unexpected error: logs as error with stack, returns 500
 *
 * @param {Response} res
 * @param {Error|AppError} err
 * @param {string} context - label shown in the log, e.g. "escrow.pay"
 */

const handleError = (res, err, context = "unknown") => {
  if (err instanceof AppError) {
    logger.warn(`[${context}] rejected`, { reason: err.message, status: err.status, ...err.meta });
    return res.status(err.status).json({ success: false, message: err.message, ...err.meta });
  }
  logger.error(`[${context}] unexpected error`, { error: err.message, stack: err.stack });
  return res.status(500).json({ success: false, message: "Internal server error" });
};

module.exports = AppError;
module.exports.handleError = handleError;