// middleware/rateLimiter.js
const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const {RedisStore}= require("rate-limit-redis");
const Redis = require("ioredis");
const logger = require("../utils/logger");
// ─────────────────────────────────────────────────────────────
// Redis client
// Set these in your .env:
//   REDIS_HOST=127.0.0.1
//   REDIS_PORT=6379
//   REDIS_PASSWORD=yourpassword   (optional)
//   REDIS_TLS=false               (set true on Railway/Render)
// ─────────────────────────────────────────────────────────────
const redisClient = new Redis({
    host: process.env.REDIS_HOST || "127.0.0.1",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    tls: process.env.REDIS_TLS === "true" ? {} : undefined,
});

redisClient.on("connect", () => logger.info("✅ Redis connected (rate limiter)"));
redisClient.on("error", (err) => logger.error("❌ Redis error:", err.message));

// ─────────────────────────────────────────────────────────────
// Factory — creates a Redis-backed store with a unique prefix
// prefix keeps keys namespaced per limiter in Redis
// e.g.  rl:login:192.168.1.1
//       rl:upload:64f2a3b1c9e4a5d6
// ─────────────────────────────────────────────────────────────
const makeStore = (prefix) =>
    new RedisStore({
        sendCommand: (...args) => redisClient.call(...args),
        prefix,
    });

// ─────────────────────────────────────────────────────────────
// IP-based limiter factory
// Used for unauthenticated routes — no user identity available
// ─────────────────────────────────────────────────────────────
const makeIpLimiter = ({prefix, windowMs, max, message}) =>
    rateLimit({
        windowMs,
        max,
        message: { message },
        standardHeaders: true,
        legacyHeaders: false,
        store: makeStore(prefix),
        keyGenerator: (req) => ipKeyGenerator(req),
    });

// ─────────────────────────────────────────────────────────────
// User-based limiter factory
// Used for authenticated routes — uses userId from JWT
// Falls back to IP if user not available
// ─────────────────────────────────────────────────────────────
const makeUserLimiter = ({prefix, windowMs, max, message}) =>
    rateLimit({
        windowMs,
        max,
        message: { message },
        standardHeaders: true,
        legacyHeaders: false,
        store: makeStore(prefix),
        keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
    });

// ─────────────────────────────────────────────────────────────
// GLOBAL — safety net for ALL /api/v1 routes
// Applied in app.js
// 200 requests per 15 minutes per user/IP
// ─────────────────────────────────────────────────────────────
exports.globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    message: { message: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore("rl:global:"),
    keyGenerator: (req) => req.user?._id?.toString() || ipKeyGenerator(req),
    skip: (req) => req.method === "GET",  // ← only count POST/PUT/PATCH/DELETE
});
// AUTH
exports.loginLimiter = makeIpLimiter({
    prefix: "rl:login:",
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many login attempts. Try again after 15 minutes.",
});

exports.registerLimiter = makeIpLimiter({
    prefix: "rl:register:",
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many registrations from this IP. Try again after an hour.",
});

exports.oauthLimiter = makeIpLimiter({
    prefix: "rl:oauth:",
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: "Too many auth attempts. Try again after 15 minutes.",
});

exports.forgotPasswordLimiter = makeIpLimiter({
    prefix: "rl:forgot:",
    windowMs: 60 * 60 * 1000,
    max: 5,
    message: "Too many password reset requests. Try again after an hour.",
});

exports.otpLimiter = makeIpLimiter({
    prefix: "rl:otp:",
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "Too many OTP attempts. Try again after 15 minutes.",
});

exports.resendLimiter = makeIpLimiter({
    prefix: "rl:resend:",
    windowMs: 60 * 60 * 1000,
    max: 3,
    message: "Too many resend requests. Try again after an hour.",
});

exports.adminLoginLimiter = makeIpLimiter({
    prefix: "rl:adminlogin:",
    windowMs: 15 * 60 * 1000,
    max: 3,
    message: "Too many admin login attempts. Try again after 15 minutes.",
});

exports.supportLimiter = makeIpLimiter({
    prefix: "rl:support:",
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many support messages. Try again after an hour.",
});

// AUTHENTICATED
exports.uploadLimiter = makeUserLimiter({
    prefix: "rl:upload:",
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many upload requests. Try again after an hour.",
});

exports.reportLimiter = makeUserLimiter({
    prefix: "rl:report:",
    windowMs: 60 * 60 * 1000,
    max: 10,
    message: "Too many report submissions. Try again after an hour.",
});