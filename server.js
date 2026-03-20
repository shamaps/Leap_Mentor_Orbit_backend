// backend/server.js
require("dotenv").config();
const express    = require("express");
const mongoose   = require("mongoose");
const cors       = require("cors");
const http       = require("http");
const { Server } = require("socket.io");
const socketAuth           = require("./socket/socketAuth");
const socketHandler        = require("./socket/socketHandler");
const { verifyConnection } = require("./config/cloudinary");

const app = express();

/* ===========================
   🔹 MIDDLEWARE
=========================== */
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:3000",
  ],
  credentials: true,
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  // Allow popup → opener postMessage communication for Google OAuth callback
  if (req.path.startsWith("/api/google-calendar/callback")) {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  } else {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  }
  next();
});

/* ===========================
   🔹 DATABASE CONNECTION
=========================== */
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ MongoDB Connected");
    verifyConnection(); // ✅ verify Cloudinary after DB connects
  })
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

/* ===========================
   🔹 ROUTES
=========================== */
app.use("/api/auth",             require("./routes/auth.routes"));
app.use("/api/verification",     require("./routes/verification.routes"));
app.use("/api/auth",             require("./routes/forgotPassword.routes"));
app.use("/api/users",            require("./routes/user.routes"));
app.use("/api/mentor-profile",   require("./routes/mentorProfile.routes"));
app.use("/api/mentee-profile",   require("./routes/menteeProfile.routes"));
app.use("/api/mentors",          require("./routes/mentorSearch.routes"));
app.use("/api/availability",     require("./routes/availability.routes"));
app.use("/api/connect-requests", require("./routes/connectRequest.routes"));
app.use("/api/slot-locks",       require("./routes/slotLock.routes"));
app.use("/api/escrow",           require("./routes/escrow.routes"));
app.use("/api/invoices",         require("./routes/invoice.routes"));
app.use("/api/goals",            require("./routes/goal.routes"));
app.use("/api/messages",         require("./routes/message.routes"));
app.use("/api/notes",            require("./routes/note.routes"));
app.use("/api/notifications",    require("./routes/notifications"));
app.use("/api/feedback",         require("./routes/feedback.routes"));
app.use("/api/reports",          require("./routes/report.routes"));
app.use("/api/sessions",         require("./routes/session.routes"));
app.use("/api/private-notes",    require("./routes/privateNote.routes"));
app.use("/api/mentor/earnings",  require("./routes/earnings.routes"));
app.use("/api/google-calendar",  require("./routes/googleCalendar.routes")); // ✅ Google Calendar integration
// admin
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/admin/settings",  require("./routes/adminSettings.routes"));
app.use("/api/admin/payments",  require("./routes/adminPayments.routes"));
app.use("/api/admin/reports",  require("./routes/adminReports.routes"));
app.use("/api/support", require("./routes/support.routes"));

app.get("/", (req, res) => res.send("🚀 LeapMentor API Running..."));

/* ===========================
   🔹 CRON JOBS
=========================== */
const { startCleanupCron } = require("./cron/cleanupAvailability");
startCleanupCron();

const { startSessionReminderCron } = require("./cron/sessionReminders");
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
