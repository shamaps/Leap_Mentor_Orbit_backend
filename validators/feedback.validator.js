const Joi = require("joi");

/**
 * Joi parsing logic boundary checking parameters for user feedback entry creation.
 * @type {Joi.ObjectSchema}
 * @property {string} connectRequestId - 24-character hexadecimal sequence string matching MongoDB ObjectId rules.
 * @property {number} rating - Mandatory evaluation number bounded between a min of 1 and max of 5.
 * @property {string} [comment] - Optional validation string context allowing empty strings up to 1000 characters.
 * @property {number} [slotIndex] - Optional integer index tracking individual slot properties starting from 0 floor bounds.
 */
const submitFeedbackSchema = Joi.object({
    connectRequestId: Joi.string().hex().length(24).required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(1000).allow("").optional(),
    slotIndex: Joi.number().integer().min(0).optional(),
});

module.exports = { submitFeedbackSchema };