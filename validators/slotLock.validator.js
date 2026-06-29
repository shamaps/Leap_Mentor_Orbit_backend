// validators/slotLock.validator.js
const Joi = require("joi");

/**
 * Joi schematic framework parsing parameters validation rules checking structural slot-locking bodies.
 * @type {Joi.ObjectSchema}
 * @property {string} mentorId - 24-character hexadecimal tracking sequence string matching MongoDB ObjectId specifications.
 * @property {string} date - Calendar day string metric value matching "YYYY-MM-DD" regular expressions pattern.
 * @property {string} startTime - Operational clock format start index matching strictly "HH:MM" pattern limits.
 * @property {string} endTime - Operational clock format terminal index matching strictly "HH:MM" pattern limits.
 */
const lockSlotSchema = Joi.object({
    mentorId: Joi.string().hex().length(24).required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

/**
 * Joi parsing logic checking parameter strings to execute a lock removal payload validation.
 * @type {Joi.ObjectSchema}
 * @property {string} mentorId - 24-char hexadecimal locator index conforming to database standards.
 * @property {string} date - Calendar target day matching "YYYY-MM-DD" pattern criteria.
 * @property {string} startTime - Starting timeline hour metric enforced as "HH:MM".
 * @property {string} endTime - Terminating timeline hour metric enforced as "HH:MM".
 */
const unlockSlotSchema = Joi.object({
    mentorId: Joi.string().hex().length(24).required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

module.exports = { lockSlotSchema, unlockSlotSchema };