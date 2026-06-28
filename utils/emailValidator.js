// utils/emailValidator.js
// ReDoS-safe email regex — avoids adjacent quantified groups that cause backtracking.
// Enforces: localPart @ domain . tld
// - local part: no @ or whitespace
// - domain: no @ or whitespace  
// - tld: 2-63 chars, letters only
// Input is also bounded by maxlength at the schema level.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]{1,253}\.[a-zA-Z]{2,63}$/;

const emailValidator = [EMAIL_REGEX, "Invalid email format"];

module.exports = { emailValidator };