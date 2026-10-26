// middleware/internalAuth.js
//
// Guards service-to-service ("internal") routes.
const crypto = require("node:crypto");
const logger = require("../utils/logger");

const tokenEnvName = (caller, service) =>
    `${caller}_TO_${service}_TOKEN`.toUpperCase().replace(/[^A-Z0-9_]/g, "_");

const safeEqual = (given, expected) => {
    const a = Buffer.from(String(given ?? ""));
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * @param {Object} options
 * @param {string} options.service   Name of the service that owns the routes (e.g. "payments").
 * @param {string[]} options.callers Names of services allowed to call it (e.g. ["engagement"]).
 * @returns {import('express').RequestHandler}
 */
const requireInternalAuth = ({ service, callers }) => {
    const allowed = callers.map((c) => String(c).toLowerCase());

    return (req, res, next) => {
        const caller = String(req.headers["x-caller-service"] || "").toLowerCase();
        const given = req.headers["x-internal-token"];

        if (!allowed.includes(caller)) {
            logger.warn("Rejected internal call: caller not allowed", { service, caller: caller || "none", path: req.path, ip: req.ip });
            return res.status(401).json({ success: false, message: "Invalid internal credentials" });
        }

        const expected = process.env[tokenEnvName(caller, service)];
        if (!expected) {
            logger.error("Internal auth is not configured for caller", { service, caller, envVar: tokenEnvName(caller, service) });
            return res.status(503).json({ success: false, message: "Internal service authentication is not configured" });
        }

        if (!safeEqual(given, expected)) {
            logger.warn("Rejected internal call: bad token", { service, caller, path: req.path, ip: req.ip });
            return res.status(401).json({ success: false, message: "Invalid internal credentials" });
        }

        req.internalCaller = caller;
        return next();
    };
};

module.exports = { requireInternalAuth, tokenEnvName };