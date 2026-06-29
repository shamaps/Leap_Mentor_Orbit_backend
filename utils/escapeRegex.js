// utils/escapeRegex.js
const escapeRegex = (str) =>
    str.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = { escapeRegex };