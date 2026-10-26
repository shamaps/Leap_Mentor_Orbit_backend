require("@leapmentor/shared/instrument");
require("dotenv").config();

const http = require("node:http");
const { Server } = require("socket.io");
const Sentry = require("@sentry/node");
const logger = require("@leapmentor/shared/utils/logger");
const { registerGracefulShutdown } = require("@leapmentor/shared/utils/gracefulShutdown");
const { connectDB } = require("@leapmentor/shared/config/database");
const app = require("./app");
const socketAuth = require("./socket/socketAuth");
const socketHandler = require("./socket/socketHandler");
const { startSessionReminderCron } = require("./cron/sessionReminders");

process.on("unhandledRejection", (reason) => {
    Sentry.captureException(reason);
    logger.error("Unhandled Promise Rejection", { reason: reason?.message || reason, stack: reason?.stack });
});
process.on("uncaughtException", (err) => {
    Sentry.captureException(err);
    logger.error("Uncaught Exception", { error: err.message, stack: err.stack });
    if (!err.isOperational) process.exit(1);
});

(async () => {
    await connectDB();
    startSessionReminderCron(); 

    const httpServer = http.createServer(app);

    const io = new Server(httpServer, {
        cors: {
            origin: process.env.SOCKET_CORS_ORIGINS?.split(",").map((s) => s.trim()) ?? [],
            credentials: true,
        },
        pingTimeout: 60000,
        pingInterval: 25000,
    });
    io.use(socketAuth);
    socketHandler(io);

    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => logger.info(`communication service listening on port ${PORT}`));

    registerGracefulShutdown({ name: "communication", server: httpServer, closeServer: (cb) => io.close(cb) });
})();