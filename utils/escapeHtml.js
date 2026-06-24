// utils/escapeHtml.js
/**
 * Escapes HTML special characters to prevent injection when
 * interpolating user-controlled strings into email/HTML templates.
 */
const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
        .replaceAll(/&/g, "&amp;")
        .replaceAll(/</g, "&lt;")
        .replaceAll(/>/g, "&gt;")
        .replaceAll(/"/g, "&quot;")
        .replaceAll(/'/g, "&#39;");
};

module.exports = { escapeHtml };