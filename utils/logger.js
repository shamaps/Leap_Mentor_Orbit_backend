// utils/logger.js
// Log analysis: BetterStack alert configured for sensitive keyword detection
// Alert: "Sensitive keyword in logs" — notifies on any accidental PII in logs
const { createLogger, format, transports } = require("winston");
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");
const { logger: sentryLogger } = require("@sentry/node");
const { sanitize } = require("./sanitize");
const isProd = process.env.NODE_ENV === "production";

const logtail = process.env.LOGTAIL_TOKEN
    ? new Logtail(process.env.LOGTAIL_TOKEN)
    : null;

const logTransports = [
    new transports.Console({
        format: isProd
            ? format.combine(format.timestamp(), format.json())
            : format.combine(
                format.colorize(),
                format.timestamp({ format: "HH:mm:ss" }),
                format.printf(({ level, message, timestamp, ...meta }) => {
                    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : "";
                    return `${timestamp} [${level}] ${message}${metaStr}`;
                })
            ),
    }),
];

if (logtail) {
    logTransports.push(new LogtailTransport(logtail));
}

const winstonLogger = createLogger({
    level: isProd ? "info" : "debug",
    transports: logTransports,
});

module.exports = {
    info: (msg, meta = {}) => { winstonLogger.info(msg, sanitize(meta)); },
    warn: (msg, meta = {}) => { const s = sanitize(meta); winstonLogger.warn(msg, s); sentryLogger.warn(msg, s); },
    error: (msg, meta = {}) => { const s = sanitize(meta); winstonLogger.error(msg, s); sentryLogger.error(msg, s); },
    debug: (msg, meta = {}) => { winstonLogger.debug(msg, sanitize(meta)); },
};