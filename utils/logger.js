// utils/logger.js
const { logger: sentryLogger } = require("@sentry/node");

const format = (level, msg, meta) => {
    const base = `[${level.toUpperCase()}] ${msg}`;
    return meta ? `${base} ${JSON.stringify(meta)}` : base;
};

module.exports = {
    info: (msg, meta) => {
        console.log(format("info", msg, meta));
        sentryLogger.info(msg, meta);
    },
    warn: (msg, meta) => {
        console.warn(format("warn", msg, meta));
        sentryLogger.warn(msg, meta);
    },
    error: (msg, meta) => {
        console.error(format("error", msg, meta));
        sentryLogger.error(msg, meta);
    },
};