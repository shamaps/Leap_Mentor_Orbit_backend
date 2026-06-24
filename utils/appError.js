// utils/appError.js

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

const handleError = (res, err, context = "unknown") => {
  //  Mongoose schema validation failed (minlength, enum, required, etc.)
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    logger.warn(`[${context}] validation error`, { messages });
    return res.status(400).json({ success: false, errors: messages });
  }

  // MongoDB duplicate key (unique index violation, e.g. duplicate email)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    logger.warn(`[${context}] duplicate key`, { field, value: err.keyValue?.[field] });
    return res.status(409).json({ success: false, message: `${field} already exists` });
  }

  if (err instanceof AppError) {
    logger.warn(`[${context}] rejected`, { reason: err.message, status: err.status, ...err.meta });
    return res.status(err.status).json({ success: false, message: err.message, ...err.meta });
  }

  logger.error(`[${context}] unexpected error`, { error: err.message, stack: err.stack });
  return res.status(500).json({ success: false, message: "Internal server error" });
};

module.exports = AppError;
module.exports.handleError = handleError;