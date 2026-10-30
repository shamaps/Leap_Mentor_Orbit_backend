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


module.exports = { paySchema };