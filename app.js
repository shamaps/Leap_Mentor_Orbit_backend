// backend/app.js
// ✅ Pure Express app — no DB connection, no server start, no cron jobs
// This is what Jest imports for testing
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Sentry = require("@sentry/node");

const app = express();

const cookieParser = require("cookie-parser");
app.use(cookieParser());

/* ===========================
   🔹 MIDDLEWARE
=========================== */
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "http://localhost:5173",
      "http://localhost:3000",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (!origin) return callback(null, true);  // Postman / curl
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization",'baggage','sentry-trace',],
}));

// Sentry request tagging
app.use((req, res, next) => {
  Sentry.withScope((scope) => {
    scope.setTag("route", req.path);
    scope.setTag("method", req.method);
    next();
  });
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use((req, res, next) => {
  if (req.path.startsWith("/api/v1/google-calendar/callback")) {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
  } else {
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  }
  next();
});

/* ===========================
   🔹 RATE LIMITING
   Must be BEFORE routes are mounted
   so limiters fire before any controller runs
=========================== */
app.set("trust proxy", 1);

const { globalLimiter } = require("./middleware/rateLimiter");
app.use("/api/v1", globalLimiter);                         // ← applies global + all route-specific limiters

/* ===========================
   🔹 API v1 ROUTER
=========================== */
const v1 = express.Router();

v1.use("/ai", require("./routes/ai.routes"));
v1.use("/auth", require("./routes/auth.routes"));
v1.use("/auth", require("./routes/forgotPassword.routes"));
v1.use("/verification", require("./routes/verification.routes"));
v1.use("/users", require("./routes/user.routes"));
v1.use("/upload", require("./routes/upload.routes"));
v1.use("/mentor-profile", require("./routes/mentorProfile.routes"));
v1.use("/mentee-profile", require("./routes/menteeProfile.routes"));
v1.use("/mentors", require("./routes/mentorSearch.routes"));
v1.use("/availability", require("./routes/availability.routes"));
v1.use("/connect-requests", require("./routes/connectRequest.routes"));
v1.use("/slot-locks", require("./routes/slotLock.routes"));
v1.use("/escrow", require("./routes/escrow.routes"));
v1.use("/invoices", require("./routes/invoice.routes"));
v1.use("/goals", require("./routes/goal.routes"));
v1.use("/messages", require("./routes/message.routes"));
v1.use("/notes", require("./routes/note.routes"));
v1.use("/notifications", require("./routes/notifications"));
v1.use("/feedback", require("./routes/feedback.routes"));
v1.use("/reports", require("./routes/report.routes"));
v1.use("/sessions", require("./routes/session.routes"));
v1.use("/private-notes", require("./routes/privateNote.routes"));
v1.use("/mentor/earnings", require("./routes/earnings.routes"));
v1.use("/google-calendar", require("./routes/googleCalendar.routes"));
v1.use("/support", require("./routes/support.routes"));
v1.use("/leap-requests", require("./routes/leapRequest.routes"));

// Admin routes
v1.use("/admin", require("./routes/admin.routes"));
v1.use("/admin/settings", require("./routes/adminSettings.routes"));
v1.use("/admin/payments", require("./routes/adminPayments.routes"));
v1.use("/admin/reports", require("./routes/adminReports.routes"));
v1.use("/admin/mentor-verifications", require("./routes/adminVerification.routes"));

/* ===========================
   🔹 MOUNT VERSIONED ROUTER
=========================== */
app.use("/api/v1", v1);

app.get("/", (req, res) => res.send("🚀 LeapMentor API Running..."));

Sentry.setupExpressErrorHandler(app);

module.exports = app;