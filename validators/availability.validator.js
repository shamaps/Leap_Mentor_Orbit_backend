const Joi = require("joi");

const timeSlotSchema = Joi.object({
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

// Frontend groups slots by date — { date, slots: [...] }
const specificDateSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    slots: Joi.array().items(timeSlotSchema).min(1).required(),
});

const saveAvailabilitySchema = Joi.object({
    timezone: Joi.string().required(),
    sessionDurations: Joi.array().items(Joi.number().valid(30, 60, 90)).min(1).required(),
    specificDates: Joi.array().items(specificDateSchema).required(),
    googleCalendarConnected: Joi.boolean().optional(),
});

module.exports = { saveAvailabilitySchema };