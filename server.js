// backend/server.js
//  Entry point — connects DB, starts HTTP server, Socket.io, cron jobs
// Jest does NOT import this file — it imports app.js directly
require("./instrument");
require("dotenv").config();

const express = require("express");
const http       = require("node:http");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");

const app                  = require("./app");
const socketAuth           = require("./socket/socketAuth");
const socketHandler        = require("./socket/socketHandler");
const { verifyConnection } = require("./config/cloudinary");

/* ===========================
   🔹 DATABASE CONNECTION
=========================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    verifyConnection();
  })
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

/* ===========================
   🔹 CRON JOBS
=========================== */
const { startCleanupCron }         = require("./cron/cleanupAvailability");
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
  pingTimeout:  60000,
  pingInterval: 25000,
});

io.use(socketAuth);
socketHandler(io);

/* ===========================
   🔹 START SERVER
=========================== */
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`🔥 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready`);
  console.log(`📡 Using Client ID: ${process.env.GOOGLE_CLIENT_ID ? "LOADED" : "NOT FOUND"}`);
});