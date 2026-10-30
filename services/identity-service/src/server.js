require("@leapmentor/shared/instrument");
require("dotenv").config();

const http = require("node:http");
const Sentry = require("@sentry/node");
const logger = require("@leapmentor/shared/utils/logger");
const { registerGracefulShutdown } = require("@leapmentor/shared/utils/gracefulShutdown");
const { connectDB } = require("@leapmentor/shared/config/database");
const app = require("./app");
const { userCascade } = require("./config/container");
const { startUserCascadeWorker } = require("./workers/userCascadeWorker");
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
  const PORT = process.env.PORT || 5000;
  const server = http.createServer(app).listen(PORT, () => logger.info(`identity service listening on port ${PORT}`));
 const cascadeWorker = startUserCascadeWorker({ userCascade });
  registerGracefulShutdown({
    name: "identity",
    server,
    closeServer: (cb) => {
      cascadeWorker.stop().catch(() => {}).finally(() => server.close(cb));
    },
  });
})();