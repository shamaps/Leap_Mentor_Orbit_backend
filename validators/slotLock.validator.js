const Joi = require("joi");

const lockSlotSchema = Joi.object({
    mentorId: Joi.string().hex().length(24).required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

const unlockSlotSchema = Joi.object({
    mentorId: Joi.string().hex().length(24).required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

module.exports = { lockSlotSchema, unlockSlotSchema };