// validators/escrow.validator.js
const Joi = require("joi");

const paySchema = Joi.object({
    connectRequestId: Joi.string().hex().length(24).required().messages({
        "string.hex": "connectRequestId must be a valid MongoDB ObjectId",
        "any.required": "connectRequestId is required",
    }),
    sessionRate: Joi.number().min(1).required().messages({
        "number.min": "sessionRate must be at least 1",
        "any.required": "sessionRate is required",
    }),
    sessionCount: Joi.number().integer().min(1).required().messages({
        "number.min": "sessionCount must be at least 1",
        "any.required": "sessionCount is required",
    }),
});

const escrowActionSchema = Joi.object({
    action: Joi.string().valid("release", "refund").required().messages({
        "any.only": "action must be release or refund",
        "any.required": "action is required",
    }),
    reason: Joi.string().max(500).optional(),
});

module.exports = { paySchema, escrowActionSchema };