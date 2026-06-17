// utils/response.js

/**
 * Standard success response
 * { success: true, data: { ... } }
 */
const ok = (res, data = {}, status = 200) =>
    res.status(status).json({ success: true, data });

/**
 * Standard created response (POST that creates a resource)
 * { success: true, data: { ... } }
 */
const created = (res, data = {}) =>
    res.status(201).json({ success: true, data });

/**
 * Standard error response
 * { success: false, message: "..." }
 */
const fail = (res, message, status = 400) =>
    res.status(status).json({ success: false, message });

/**
 * Standard 204 - no content (DELETE with nothing to return)
 */
const noContent = (res) => res.status(204).send();

module.exports = { ok, created, fail, noContent };