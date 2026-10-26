// utils/internalClient.js
const AppError = require("./appError");
const logger = require("./logger");
const { getTraceId } = require("./requestContext");

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const read = (value) => (typeof value === "function" ? value() : value);
const titleCase = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * @param {Object} options
 * @param {string} options.caller   This service's name, e.g. "engagement".
 * @param {string} options.target   The service being called, e.g. "payments".
 * @param {string|Function} options.baseUrl  e.g. "http://payments-service:5004".
 * @param {string|Function} options.token    This caller->target secret.
 * @param {number} [options.timeoutMs=3000]  Per-attempt timeout.
 * @param {number} [options.retries=2]       Extra attempts when retrying is safe.
 * @param {number} [options.retryDelayMs=150]
 */
const createInternalClient = ({ caller, target, baseUrl, token, timeoutMs = 3000, retries = 2, retryDelayMs = 150 }) => {
    if (!caller || !target) throw new Error("createInternalClient requires caller and target");
    const label = titleCase(target);

    const request = async (method, path, { body, idempotencyKey, query } = {}) => {
        const root = read(baseUrl);
        const secret = read(token);
        if (!root) throw new AppError(503, `${label} service is not configured`, { upstream: target });
        if (!secret) throw new AppError(503, `${label} service credentials are not configured`, { upstream: target });

        const qs = query ? `?${new URLSearchParams(query).toString()}` : "";
        const url = `${String(root).replace(/\/$/, "")}${path}${qs}`;

        const headers = {
            Accept: "application/json",
            "X-Internal-Token": secret,
            "X-Caller-Service": caller,
        };
        const traceId = getTraceId();
        if (traceId && traceId !== "no-trace") headers["X-Trace-Id"] = traceId;
        if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;
        if (body !== undefined) headers["Content-Type"] = "application/json";

        const canRetry = method === "GET" || method === "HEAD" || Boolean(idempotencyKey);
        const maxAttempts = canRetry ? 1 + retries : 1;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            const last = attempt === maxAttempts;
            let res;
            try {
                res = await fetch(url, {
                    method,
                    headers,
                    body: body !== undefined ? JSON.stringify(body) : undefined,
                    signal: AbortSignal.timeout(timeoutMs),
                });
            } catch (err) {
                const timedOut = err?.name === "TimeoutError" || err?.name === "AbortError";
                logger.warn("Internal call failed", { target, method, path, attempt, maxAttempts, timedOut, error: err.message });
                if (!last) {
                    await sleep(retryDelayMs * attempt);
                    continue;
                }
                throw timedOut
                    ? new AppError(504, `${label} service timed out`, { upstream: target })
                    : new AppError(503, `${label} service is unavailable`, { upstream: target });
            }

            const text = await res.text();
            let payload = null;
            if (text) {
                try { payload = JSON.parse(text); } catch { payload = { message: text.slice(0, 200) }; }
            }

            if (res.ok) return payload;

            if (res.status >= 500) {
                logger.warn("Internal call got a server error", { target, method, path, attempt, maxAttempts, status: res.status });
                if (!last) {
                    await sleep(retryDelayMs * attempt);
                    continue;
                }
                throw new AppError(502, `${label} service returned an error`, { upstream: target });
            }

            // 4xx: the target understood and rejected the request. Never retried.
            throw new AppError(res.status, payload?.message || `${label} service rejected the request`, { upstream: target });
        }
      
        throw new AppError(503, `${label} service is unavailable`, { upstream: target });
    };

    return {
        get: (path, opts) => request("GET", path, opts),
        post: (path, opts) => request("POST", path, opts),
        put: (path, opts) => request("PUT", path, opts),
        patch: (path, opts) => request("PATCH", path, opts),
        delete: (path, opts) => request("DELETE", path, opts),
    };
};

module.exports = { createInternalClient };