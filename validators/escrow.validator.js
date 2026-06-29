// validators/escrow.validator.js
const Joi = require("joi");

/**
 * Joi schematic boundary parser confirming primary allocation properties on payment setups.
 * @type {Joi.ObjectSchema}
 * @property {string} connectRequestId - 24-character hexadecimal sequence conforming to MongoDB ObjectId definitions.
 * @property {number} sessionRate - Price boundary configuration specifying a minimum of 1 token.
 * @property {number} sessionCount - Integer quantity tracking requested volume, minimum 1.
 */
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

/**
 * Joi parser checking literal choices governing settlement releases or cancellation procedures.
 * @type {Joi.ObjectSchema}
 * @property {string} action - Explicit constraint limited strictly to tracking arguments ("release" or "refund").
 * @property {string} [reason] - Optional descriptive summary text capped at 500 characters.
 */
const escrowActionSchema = Joi.object({
    action: Joi.string().valid("release", "refund").required().messages({
        "any.only": "action must be release or refund",
        "any.required": "action is required",
    }),
    reason: Joi.string().max(500).optional(),
});

module.exports = { paySchema, escrowActionSchema };