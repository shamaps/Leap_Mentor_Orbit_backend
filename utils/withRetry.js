// utils/withRetry.js
const logger = require("./logger");

/**
 * Retries an async operation with exponential backoff.
 * Only retries errors considered transient (network/timeout/5xx/429) by default.
 *
 * @param {Function} fn - async function to call, no args, returns a Promise
 * @param {Object} options
 * @param {number} options.retries - max attempts (default 3)
 * @param {number} options.baseDelayMs - initial backoff delay (default 300ms)
 * @param {string} options.label - used in log messages
 * @param {Function} [options.isRetryable] - (err) => boolean, defaults to network/5xx/429 check
 */
const defaultIsRetryable = (err) => {
    if (err?.status === 504) return true; // our own withTimeout AppError
    const httpCode = err?.http_code || err?.response?.status || err?.code;
    if (httpCode === 429) return true;
    if (typeof httpCode === "number" && httpCode >= 500) return true;
    if (["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND"].includes(err?.code)) return true;
    return false;
};

const withRetry = async (fn, { retries = 3, baseDelayMs = 300, label = "operation", isRetryable = defaultIsRetryable } = {}) => {
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastErr = err;
            const canRetry = isRetryable(err);
            if (!canRetry || attempt === retries) break;
            const delay = baseDelayMs * 2 ** (attempt - 1);
            logger.warn(`[${label}] attempt ${attempt} failed, retrying in ${delay}ms`, { error: err.message });
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
    throw lastErr;
};

module.exports = { withRetry };