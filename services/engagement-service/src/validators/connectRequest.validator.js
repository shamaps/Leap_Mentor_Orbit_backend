// validators/connectRequest.validator.js
const Joi = require("joi");

/**
 * Joi schematic object parsing parameters mapping time properties.
 * @type {Joi.ObjectSchema}
 * @property {string} day - Weekday literal label value validation rule.
 * @property {string} date - Structured string configuration variable.
 * @property {string} startTime - Operational timeline bounds start value.
 * @property {string} endTime - Operational timeline bounds terminal value.
 */
const slotSchema = Joi.object({
    day: Joi.string().required(),
    date: Joi.string().required(),
    startTime: Joi.string().required(),
    endTime: Joi.string().required(),
});

/**
 * Joi schema checking initial presentation parameter blocks for connect request delivery.
 * @type {Joi.ObjectSchema}
 * @property {string} mentorId - 24-char hexadecimal string matching MongoDB ObjectId standards.
 * @property {Joi.ArraySchema} selectedSlots - Proportional bounding map ensuring between 1 and 5 time units are selected.
 * @property {number} sessionRate - Numeric boundary parameter indicating floor pricing context.
 * @property {number} sessionCount - Integer tracking count iterations parameters.
 * @property {string} [message] - Optional literal input tracking descriptive text up to 500 characters.
 */
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

/**
 * Joi verification validator monitoring choice outcomes sent by host users.
 * @type {Joi.ObjectSchema}
 * @property {string} status - Constrained choice string tracking valid states ("accepted", "rejected").
 * @property {Joi.ObjectSchema} [confirmedSlot] - Conditional structure enforced strictly if status field matches "accepted".
 */
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