// backend/server.js
//  Entry point — connects DB, starts HTTP server, Socket.io, cron jobs
// Jest does NOT import this file — it imports app.js directly
require("./instrument");
require("dotenv").config();

const express = require("express");
const http = require("node:http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Sentry = require("@sentry/node");
const logger = require("./utils/logger");
const app = require("./app");
const socketAuth = require("./socket/socketAuth");
const socketHandler = require("./socket/socketHandler");
const { verifyConnection } = require("./config/cloudinary");
const config = require("./config/env"); 
/* ===========================
   🔹 PROCESS-LEVEL SAFETY NETS
   Must be registered once, before anything else can throw/reject.
=========================== */
process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
  logger.error("Unhandled Promise Rejection", {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
});

process.on("uncaughtException", (err) => {
  Sentry.captureException(err);
  logger.error("Uncaught Exception", {
    error: err.message,
    stack: err.stack,
    isOperational: !!err.isOperational,
  });
  if (!err.isOperational) {
    process.exit(1);
  }
});
/* ===========================
   🔹 DATABASE CONNECTION
=========================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    logger.info("MongoDB connected");
    verifyConnection();
  })
  .catch((err) => {
    logger.error("MongoDB connection failed — exiting", { error: err.message });
    process.exit(1);
  });

/* ===========================
   🔹 CRON JOBS
=========================== */
const { startCleanupCron } = require("./cron/cleanupAvailability");
const { startSessionReminderCron } = require("./cron/sessionReminders");
startCleanupCron();
startSessionReminderCron();

/* ===========================
   🔹 HTTP SERVER + SOCKET.IO
=========================== */
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: [
      "http://localhost:5173",
      "http://localhost:5174",
      "http://localhost:3000",
      "http://localhost:4173",
      process.env.APP_BASE_URL,
    ],
    credentials: true,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.use(socketAuth);
socketHandler(io);

/* ===========================
   🔹 START SERVER
=========================== */
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  logger.info(`🔥 Server running on port ${PORT}`);
  logger.info(`🔌 Socket.io ready`);
  logger.info(`📡 Using Client ID: ${process.env.GOOGLE_CLIENT_ID ? "LOADED" : "NOT FOUND"}`);
});