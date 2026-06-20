// utils/escapeHtml.js
/**
 * Escapes HTML special characters to prevent injection when
 * interpolating user-controlled strings into email/HTML templates.
 */
const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
};

module.exports = { escapeHtml };