// backend/app.js
// Pure Express app — no DB connection, no server start, no cron jobs
// This is what Jest imports for testing
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const Sentry = require("@sentry/node");
const { randomUUID } = require("node:crypto");
const logger = require("./utils/logger");
const { runWithTraceId } = require("./utils/requestContext");
const app = express();
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const imageRoutes = require("./routes/image.routes");

const cookieParser = require("cookie-parser");
app.use(cookieParser());

/* ===========================
   🔹 MIDDLEWARE
=========================== */
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      ...(process.env.CORS_ORIGINS?.split(",").map(s => s.trim()) ?? []),
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (!origin) return callback(null, true);  // Postman / curl
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "baggage", "sentry-trace", "Accept-Version"],
}));

// Sentry request tagging
app.use((req, res, next) => {
  Sentry.withScope((scope) => {
    scope.setTag("route", req.path);
    scope.setTag("method", req.method);
    next();
  });
});

app.use(helmet());
app.use((req, res, next) => {
  req.version = req.headers["accept-version"] || "1.0";
  next();
});

// Trace ID — ties all logs for one request together in Logtail.
// Honors an inbound X-Trace-Id / X-Request-Id header (from frontend, API
// gateway, or load balancer) so the same ID can be correlated end-to-end;
// falls back to generating a fresh UUID v4 if neither is present.
app.use((req, res, next) => {
  const traceId = req.headers["x-trace-id"] || req.headers["x-request-id"] || randomUUID();
  req.traceId = traceId;
  req.requestId = traceId; // kept for backward compatibility with existing code
  res.setHeader("X-Trace-Id", traceId);

  runWithTraceId(traceId, () => {
    logger.info("Incoming request", {
      method: req.method,
      path: req.path,
      ip: req.ip,
    });
    next();
  });
});
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body, { allowDots: true });
  next();
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api/v1/google-calendar/callback")) {
    res.setHeader("Cross-Origin-Opener-Policy", "unsafe-none");
    res.removeHeader("Content-Security-Policy");
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
v1.use("/notifications", require("./routes/notifications.routes"));
v1.use("/feedback", require("./routes/feedback.routes"));
v1.use("/reports", require("./routes/report.routes"));
v1.use("/sessions", require("./routes/session.routes"));
v1.use("/private-notes", require("./routes/privateNote.routes"));
v1.use("/mentor/earnings", require("./routes/earnings.routes"));
v1.use("/google-calendar", require("./routes/googleCalendar.routes"));
v1.use("/support", require("./routes/support.routes"));
v1.use("/leap-requests", require("./routes/leapRequest.routes"));

// Admin routes — all sub-paths handled inside routes/admin/index.js
v1.use("/admin", require("./routes/admin"));
app.use("/api/v1/images", imageRoutes);
/* ===========================
   🔹 MOUNT VERSIONED ROUTER
=========================== */
app.use("/api/v1", v1);

app.get("/", (req, res) => res.send("🚀 LeapMentor API Running..."));

Sentry.setupExpressErrorHandler(app);
// 404 handler 
app.use((req, res) => {
  logger.warn("Route not found", {
    method: req.method,
    path: req.path,
  });
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

/* ===========================
   🔹 GLOBAL ERROR HANDLER
   4-param signature is REQUIRED by Express to treat this as error middleware
   Catches: next(err) calls, CORS errors, middleware throws
=========================== */
const AppError = require("./utils/appError");
const { handleError } = require("./utils/appError");

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Sentry already captured it above — just respond
  logger.error("[global] Unhandled error", {
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
  });
  return handleError(res, err, `${req.method} ${req.path}`);
});

module.exports = app;