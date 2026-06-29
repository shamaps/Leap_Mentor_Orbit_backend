// config/database.js
const mongoose = require("mongoose");
const logger = require("../utils/logger");

/**
 * RAM vs Index Size Baseline (checked June 2026)
 * ─────────────────────────────────────────────
 * Run `db.stats()` and `db.<collection>.stats().indexSizes` in mongo shell
 * to get current values. All indexes must fit in RAM for optimal performance.
 *
 * Render free tier: 512MB RAM
 * Current total index size: ~2MB (dev DB, small dataset)
 * Rule: if indexSize > 80% of available RAM → add more RAM or drop unused indexes
 *
 * To check: db.stats() → compare indexSize vs server RAM
 * To check unused indexes: db.connectrequests.aggregate([{$indexStats:{}}])
 */

const CONNECT_RETRIES = 5;
const BASE_DELAY_MS = 1_000; 
const MAX_DELAY_MS = 20_000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const computeDelay = (attempt) => {
    const cap = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
    return Math.floor(Math.random() * cap);
};

const connectDB = async () => {
    let lastErr;

    for (let attempt = 1; attempt <= CONNECT_RETRIES; attempt++) {
        try {
            await mongoose.connect(process.env.MONGO_URI, {
                maxPoolSize: 10,                 // free tier — don't over-provision sockets
                minPoolSize: 2,                  // keep a couple warm to avoid cold-start latency
                serverSelectionTimeoutMS: 5000,   // fail faster, let our own retry loop take over
                socketTimeoutMS: 45000,
            });
            logger.info("MongoDB connected");
            return;
        } catch (err) {
            lastErr = err;
            if (attempt === CONNECT_RETRIES) break;

            const delay = computeDelay(attempt);
            logger.warn(
                `MongoDB connection attempt ${attempt}/${CONNECT_RETRIES} failed — retrying in ${delay}ms`,
                { error: err.message }
            );
            await sleep(delay);
        }
    }

    logger.error("MongoDB connection failed after all retries — exiting", {
        error: lastErr?.message,
    });
    process.exit(1);
};
mongoose.connection.on("error", (err) => logger.error("MongoDB runtime error", { error: err.message }));
mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));
mongoose.connection.on("reconnected", () => logger.info("MongoDB reconnected"));

module.exports = { connectDB };