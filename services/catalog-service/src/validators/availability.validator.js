const Joi = require("joi");

/**
 * Joi parsing framework boundary checking time structure arrays.
 * @type {Joi.ObjectSchema}
 * @property {string} startTime - Format enforced to "HH:MM" tracking hour limits.
 * @property {string} endTime - Format enforced to "HH:MM" mapping bounds.
 */
const timeSlotSchema = Joi.object({
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

/**
 * Joi array tracking element separating operating segments into calendar items.
 * @type {Joi.ObjectSchema}
 * @property {string} date - Date validation format matching strictly "YYYY-MM-DD".
 * @property {Joi.ArraySchema} slots - Collection containing min 1 entry array matching slot structure rules.
 */
const specificDateSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    slots: Joi.array().items(timeSlotSchema).min(1).required(),
});

/**
 * Global execution configuration validator payload mapping parameters.
 * @type {Joi.ObjectSchema}
 * @property {string} timezone - Context location string identifier.
 * @property {number[]} sessionDurations - Enforced numeric options bounded strictly inside (30, 60, 90).
 * @property {SpecificDateConfig[]} specificDates - Structured arrays mapping schedule properties.
 * @property {boolean} [googleCalendarConnected] - Optional configuration verification hook.
 */
const saveAvailabilitySchema = Joi.object({
    timezone: Joi.string().required(),
    sessionDurations: Joi.array().items(Joi.number().valid(30, 60, 90)).min(1).required(),
    specificDates: Joi.array().items(specificDateSchema).required(),
    googleCalendarConnected: Joi.boolean().optional(),
});

module.exports = { saveAvailabilitySchema };