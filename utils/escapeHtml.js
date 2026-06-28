// utils/escapeHtml.js
/**
 * Escapes HTML special characters to prevent injection when
 * interpolating user-controlled strings into email/HTML templates.
 */
const escapeHtml = (str) => {
    if (str === null || str === undefined) return "";
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
};

module.exports = { escapeHtml };