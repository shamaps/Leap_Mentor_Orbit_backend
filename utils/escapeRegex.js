// utils/escapeRegex.js
const escapeRegex = (str) =>
    str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { escapeRegex };