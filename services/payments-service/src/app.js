require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const mongoSanitize = require("express-mongo-sanitize");
const Sentry = require("@sentry/node");
const { randomUUID } = require("node:crypto");
const logger = require("@leapmentor/shared/utils/logger");
const { runWithTraceId } = require("@leapmentor/shared/utils/requestContext");
const { handleError } = require("@leapmentor/shared/utils/appError");
const { globalLimiter } = require("@leapmentor/shared/middleware/rateLimiter");

const { createHealthRouter } = require("@leapmentor/shared/utils/health");

const app = express();

app.use("/health", createHealthRouter({ service: "payments" }));

app.use(cookieParser());
app.use(cors({
    origin(origin, callback) {
        const allowed = [
            ...(process.env.CORS_ORIGINS?.split(",").map((s) => s.trim()) ?? []),
            process.env.FRONTEND_URL,
        ].filter(Boolean);
        if (!origin || allowed.includes(origin)) return callback(null, true);
        return callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "baggage", "sentry-trace",
        "Accept-Version", "Accept", "X-Request-Id", "X-Client-Name", "X-Client-Version", "X-Trace-Id"],
}));

app.use(helmet());

app.use((req, res, next) => {
    const traceId = req.headers["x-trace-id"] || req.headers["x-request-id"] || randomUUID();
    req.traceId = traceId;
    req.requestId = traceId;
    res.setHeader("X-Trace-Id", traceId);
    runWithTraceId(traceId, () => {
        logger.info("Incoming request", { method: req.method, path: req.path, ip: req.ip });
        next();
    });
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use((req, res, next) => {
    if (req.body) req.body = mongoSanitize.sanitize(req.body, { allowDots: true });
    next();
});

app.set("trust proxy", 1);
app.use("/api/v1", globalLimiter);

const v1 = express.Router();
v1.use("/escrow", require("./routes/escrow.routes"));
v1.use("/invoices", require("./routes/invoice.routes"));
v1.use("/mentor/earnings", require("./routes/earnings.routes"));
v1.use("/admin", require("./routes/admin"));
app.use("/api/v1", v1);
app.use("/internal/users", require("./routes/internalUsers.routes"));
app.use("/internal", require("./routes/internal.routes"));

Sentry.setupExpressErrorHandler(app);

app.use((req, res) => {
    res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    logger.error("[global] Unhandled error", { method: req.method, path: req.path, error: err.message, stack: err.stack });
    return handleError(res, err, `${req.method} ${req.path}`);
});

module.exports = app;