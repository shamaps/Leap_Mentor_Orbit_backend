// utils/logger.js
const { logger: sentryLogger } = require("@sentry/node");

/**
 * Thin wrapper around Sentry's structured logger.
 * Centralizing this means the logging backend can be swapped,
 * extended (e.g. dual-write to a file), or mocked in tests
 * by editing this one file instead of 88 call sites.
 */
module.exports = {
    info: (...args) => sentryLogger.info(...args),
    warn: (...args) => sentryLogger.warn(...args),
    error: (...args) => sentryLogger.error(...args),
};