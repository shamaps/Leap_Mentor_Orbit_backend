// utils/withRetry.js
const logger = require("./logger");

/**
 * Retries an async operation with exponential backoff + full jitter.
 * Jitter prevents thundering herd — without it, concurrent failures
 * retry in synchronized waves. With jitter, each retry waits a random
 * duration between 0 and the exponential cap, spreading the load.
 *
 * @param {Function} fn - async function to call, no args, returns a Promise
 * @param {Object} options
 * @param {number} options.retries      - max attempts (default 3)
 * @param {number} options.baseDelayMs  - base backoff delay in ms (default 300)
 * @param {number} options.maxDelayMs   - ceiling on delay regardless of backoff (default 10000)
 * @param {string} options.label        - used in log messages
 * @param {Function} [options.isRetryable] - (err) => boolean
 */
const defaultIsRetryable = (err) => {
    if (err?.status === 504) return true;
    const httpCode = err?.http_code || err?.response?.status || err?.code;
    if (httpCode === 429) return true;
    if (typeof httpCode === "number" && httpCode >= 500) return true;
    if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"].includes(err?.code)) return true;
    return false;
};

/**
 * Full jitter: delay = random(0, min(maxDelayMs, baseDelayMs * 2^attempt))
 * This is the strategy recommended by AWS for distributed systems.
 * See: https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/
 */
const computeDelay = (attempt, baseDelayMs, maxDelayMs) => {
    const exponentialCap = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
    return Math.floor(Math.random() * exponentialCap);
};

const withRetry = async (
    fn,
    {
        retries = 3,
        baseDelayMs = 300,
        maxDelayMs = 10_000,
        label = "operation",
        isRetryable = defaultIsRetryable,
    } = {}
) => {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const canRetry = isRetryable(err);
            if (!canRetry || attempt === retries) break;
            const delay = computeDelay(attempt, baseDelayMs, maxDelayMs);
            logger.warn(`[${label}] attempt ${attempt}/${retries} failed — retrying in ${delay}ms`, {
                error: err.message,
                attempt,
                delay,
            });
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    logger.error(`[${label}] all ${retries} attempts failed`, { error: lastErr?.message });
    throw lastErr;
};

module.exports = { withRetry };