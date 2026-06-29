// utils/cache.js
// Application-level Redis cache — separate from rate-limiting.
// Reuses the same Redis connection config but exports a clean
// get/set/del/invalidate API so services never touch ioredis directly.
// KEY STRATEGY
// cache:commission:<adminId>     — per-admin, invalidated on updateCommission
// cache:platform_settings        — global, invalidated on session complete + user delete
// cache:mentor_list:page<n>:limit<n> — paginated, pattern-invalidated on any profile mutation,
// verification change, or user deletion
// ── Key Namespaces ────────────────────────────────────────────
// All keys are prefixed under `cache:` for easy identification in Redis CLI.
// Use `redis-cli KEYS cache:*` to inspect, `DEL cache:*` to flush all app cache.
//
// Namespace             Key pattern                         Invalidated when
// ─────────────────────────────────────────────────────────────────────────────
// COMMISSION            cache:commission:<adminId>          updateCommission()
// PLATFORM_SETTINGS     cache:platform_settings             markSlotComplete() (all done)
//                                                           blockUser()
//                                                           deleteUser()
// MENTOR_LIST           cache:mentor_list:page<n>:limit<n>  verifyMentor()
//                                                           revokeMentorVerification()
//                                                           deleteUser()
//                                                           blockUser()
//                                                           unblockUser()
//                                                           mentorProfile publish/update

const config = require("../config/env");
const Redis = require("ioredis");
const logger = require("./logger");

const redisClient = new Redis({
    host: config.redisHost,
    port: config.redisPort,
    password: config.redisPassword,
    tls: config.redisTls ? {} : undefined,
    lazyConnect: true,
    enableOfflineQueue: false,
});

redisClient.on("connect", () => logger.info("Redis connected (app cache)"));
redisClient.on("error", (err) => logger.warn("Redis cache error — falling back to DB", { error: err.message }));

const NS = {
    COMMISSION: "cache:commission",
    PLATFORM_SETTINGS: "cache:platform_settings",
    MENTOR_LIST: "cache:mentor_list",
};

const TTL = {
    COMMISSION: 5 * 60,  //  5 min
    PLATFORM_SETTINGS: 10 * 60,  // 10 min
    MENTOR_LIST: 2 * 60,  //  2 min
};

const get = async (key) => {
    try {
        const raw = await redisClient.get(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        logger.warn("Cache parse error — returning null", { raw });
        return null;
    }
};

const set = async (key, value, ttlSeconds) => {
    try {
        await redisClient.set(key, JSON.stringify(value), "EX", ttlSeconds);
    } catch (err) {
        logger.warn("Cache set failed", { key, error: err.message });
    }
};

const del = async (...keys) => {
    try {
        if (keys.length > 0) await redisClient.del(...keys);
    } catch (err) {
        logger.warn("Cache del failed", { keys, error: err.message });
    }
};

const invalidatePattern = async (pattern) => {
    try {
        const keys = await redisClient.keys(pattern);
        if (keys.length > 0) await redisClient.del(...keys);
        logger.debug("Cache invalidated", { pattern, count: keys.length });
    } catch (err) {
        logger.warn("Cache invalidation failed", { pattern, error: err.message });
    }
};

module.exports = { get, set, del, invalidatePattern, NS, TTL };