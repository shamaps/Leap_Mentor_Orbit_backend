// validators/connectRequest.validator.js
const Joi = require("joi");

const slotSchema = Joi.object({
    day: Joi.string().required(),
    date: Joi.string().required(),
    startTime: Joi.string().required(),
    endTime: Joi.string().required(),
});

const sendConnectRequestSchema = Joi.object({
    mentorId: Joi.string().hex().length(24).required().messages({
        "any.required": "mentorId is required",
        "string.hex": "mentorId must be a valid MongoDB ObjectId",
    }),
    selectedSlots: Joi.array().items(slotSchema).min(1).max(5).required().messages({
        "array.min": "At least one slot must be selected",
        "array.max": "Maximum 5 slots can be proposed",
        "any.required": "selectedSlots is required",
    }),
    sessionRate: Joi.number().min(1).required(),
    sessionCount: Joi.number().integer().min(1).required(),
    message: Joi.string().max(500).allow("").optional(),
});

const respondSchema = Joi.object({
    status: Joi.string().valid("accepted", "rejected").required(),
    confirmedSlot: Joi.object({
        day: Joi.string(),
        date: Joi.string(),
        startTime: Joi.string(),
        endTime: Joi.string(),
    }).when("status", {
        is: "accepted",
        then: Joi.required(),
        otherwise: Joi.optional(),
    }),
});

module.exports = { sendConnectRequestSchema, respondSchema };