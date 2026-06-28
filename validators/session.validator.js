const Joi = require("joi");

const addSlotSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    day: Joi.string().optional(),
});

const meetingLinkSchema = Joi.object({
    meetingLink: Joi.string().uri({ scheme: ["https"] }).required(),
});

const slotStatusSchema = Joi.object({
    action: Joi.string().valid("complete", "cancel", "reschedule").required(),
    reason: Joi.string().max(500).allow("").when("action", {
        is: "cancel", then: Joi.optional(), otherwise: Joi.forbidden(),
    }),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).when("action", {
        is: "reschedule", then: Joi.required(), otherwise: Joi.forbidden(),
    }),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).when("action", {
        is: "reschedule", then: Joi.required(), otherwise: Joi.forbidden(),
    }),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).when("action", {
        is: "reschedule", then: Joi.required(), otherwise: Joi.forbidden(),
    }),
});

module.exports = { addSlotSchema, meetingLinkSchema, slotStatusSchema };