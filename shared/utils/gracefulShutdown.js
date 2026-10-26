// shared/utils/gracefulShutdown.js
// On SIGTERM/SIGINT: stop accepting requests, let in-flight ones finish,
// close MongoDB, then exit.
// Usage (server.js):
//   registerGracefulShutdown({ name: "identity", server });
const mongoose = require("mongoose");
const logger = require("./logger");

/**
 * @param {Object} opts
 * @param {string} opts.name - Service name for log lines.
 * @param {import("http").Server} [opts.server] - HTTP server to close (used when closeServer is not given).
 * @param {(cb: Function) => void} [opts.closeServer] - Custom close step; must call cb when done.
 * @param {number} [opts.timeoutMs=10000] - Force-exit after this long.
 * @returns {(signal: string) => void} The shutdown function (handy for tests).
 */
const registerGracefulShutdown = ({ name, server, closeServer, timeoutMs = 10000 } = {}) => {
    if (!name) throw new Error("registerGracefulShutdown: 'name' is required");
    if (!server && !closeServer) throw new Error("registerGracefulShutdown: pass 'server' or 'closeServer'");

    const close = closeServer || ((cb) => server.close(cb));
    let shuttingDown = false;

    const shutdown = (signal) => {
        if (shuttingDown) return;
        shuttingDown = true;
        logger.info(`${name}: ${signal} received, shutting down`);
        setTimeout(() => process.exit(1), timeoutMs).unref();
        close(async () => {
            try {
                await mongoose.connection.close();
            } catch (err) {
                logger.error(`${name}: error closing MongoDB`, { error: err.message });
            }
            process.exit(0);
        });
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
    return shutdown;
};

module.exports = { registerGracefulShutdown };