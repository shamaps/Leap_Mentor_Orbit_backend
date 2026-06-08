// utils/mask.js
const { sanitize, sanitizeHeaders, maskEmail, maskPhone } = require("./sanitize");

module.exports = { maskEmail, maskPhone, sanitize, sanitizeHeaders };