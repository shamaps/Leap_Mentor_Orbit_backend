// utils/logger.js
const { createLogger, format, transports } = require("winston");
const { Logtail } = require("@logtail/node");
const { LogtailTransport } = require("@logtail/winston");
const { logger: sentryLogger } = require("@sentry/node");

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
    info: (msg, meta = {}) => { winstonLogger.info(msg, meta); },
    warn: (msg, meta = {}) => { winstonLogger.warn(msg, meta); sentryLogger.warn(msg, meta); },
    error: (msg, meta = {}) => { winstonLogger.error(msg, meta); sentryLogger.error(msg, meta); },
    debug: (msg, meta = {}) => { winstonLogger.debug(msg, meta); },
};