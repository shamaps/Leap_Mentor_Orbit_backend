// utils/escapeRegex.js
const escapeRegex = (str) =>
    str.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

module.exports = { escapeRegex };