// utils/sanitize.js
"use strict";

const REDACTED_KEYS = new Set([
    "password", "confirmPassword", "newPassword", "oldPassword",
    "currentPassword", "token", "accessToken", "refreshToken",
    "idToken", "sessionToken", "apiKey", "secret", "otp", "otpCode",
    "magicLink", "resetToken", "verificationToken", "cardNumber",
    "cvv", "cvc", "ssn", "pin",
]);

const PARTIAL_KEYS = new Set([
    "email", "phone", "phoneNumber", "mobile",
]);

const REDACTED_HEADERS = new Set([
    "authorization", "cookie", "x-auth-token",
    "x-api-key", "x-refresh-token", "x-access-token",
]);

function maskEmail(value) {
    if (typeof value !== "string") return "[REDACTED]";
    const atIndex = value.indexOf("@");
    if (atIndex < 0) return "[REDACTED]";
    const local = value.slice(0, atIndex);
    const domain = value.slice(atIndex);
    const visible = local.slice(0, Math.min(2, local.length));
    return `${visible}***${domain}`;
}

function maskPhone(value) {
    if (typeof value !== "string") return "[REDACTED]";
    if (value.length <= 4) return "[REDACTED]";
    return value.slice(0, 2) + "*".repeat(value.length - 4) + value.slice(-3);
}

function maskAuthHeader(value) {
    if (typeof value !== "string") return "[REDACTED]";
    const parts = value.split(" ");
    if (parts.length >= 2) return `${parts[0]} [REDACTED]`;
    return "[REDACTED]";
}

function sanitize(input, depth = 0) {
    if (depth > 10) return "[DEPTH_LIMIT]";
    if (input === null || input === undefined) return input;
    if (typeof input !== "object") return input;

    if (Array.isArray(input)) {
        return input.map((item) => sanitize(item, depth + 1));
    }

    const result = {};
    for (const [key, value] of Object.entries(input)) {
        const lowerKey = key.toLowerCase();

        if (REDACTED_KEYS.has(key) || REDACTED_KEYS.has(lowerKey)) {
            result[key] = "[REDACTED]";
            continue;
        }

        if (PARTIAL_KEYS.has(key) || PARTIAL_KEYS.has(lowerKey)) {
            result[key] = lowerKey === "email" ? maskEmail(value) : maskPhone(value);
            continue;
        }

        result[key] = sanitize(value, depth + 1);
    }

    return result;
}

function sanitizeHeaders(headers) {
    if (!headers || typeof headers !== "object") return {};
    const result = {};
    for (const [key, value] of Object.entries(headers)) {
        const lowerKey = key.toLowerCase();
        if (REDACTED_HEADERS.has(lowerKey)) {
            result[key] = lowerKey === "authorization" ? maskAuthHeader(value) : "[REDACTED]";
            continue;
        }
        result[key] = value;
    }
    return result;
}

module.exports = { sanitize, sanitizeHeaders, maskEmail, maskPhone };