// shared/utils/health.js
// Liveness/readiness probes, shared by every service.
//   GET /health/live   process is up
//   GET /health/ready  MongoDB + Redis reachable
// Usage (app.js):
//   app.use("/health", createHealthRouter({ service: "identity" }));
const express = require("express");
const mongoose = require("mongoose");

/**
 * @param {Object} opts
 * @param {string} opts.service - Service name shown in responses.
 * @param {Object<string, () => (boolean|Promise<boolean>)>} [opts.extraChecks] - Additional readiness checks.
 * @returns {import("express").Router}
 */
const createHealthRouter = ({ service, extraChecks = {} } = {}) => {
    if (!service) throw new Error("createHealthRouter: 'service' is required");

    const router = express.Router();

    router.get("/live", (_req, res) => {
        res.status(200).json({ status: "ok", service });
    });

    router.get("/ready", async (_req, res) => {
        // Required lazily so importing this file does not open a Redis connection.
        const { redisClient } = require("./cache");
        let redisOk = false;
        try {
            if (redisClient.status === "wait") await redisClient.connect();
            redisOk = (await redisClient.ping()) === "PONG";
        } catch {
            redisOk = false;
        }
        const checks = {
            mongo: mongoose.connection.readyState === 1,
            redis: redisOk,
        };
        for (const [name, check] of Object.entries(extraChecks)) {
            try {
                checks[name] = Boolean(await check());
            } catch {
                checks[name] = false;
            }
        }
        const ok = Object.values(checks).every(Boolean);
        res.status(ok ? 200 : 503).json({ status: ok ? "ready" : "not_ready", service, checks });
    });

    return router;
};

module.exports = { createHealthRouter };