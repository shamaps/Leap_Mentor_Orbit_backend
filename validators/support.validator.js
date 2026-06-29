// validators/support.validator.js
const Joi = require("joi");

/**
 * Joi schematic evaluation framework checking presentation metrics values during help ticket generation.
 * @type {Joi.ObjectSchema}
 * @property {string} email - Mandatory valid communication destination email address string checker.
 * @property {string} subject - Request title label constraint verified between 3 and 200 characters.
 * @property {string} message - Descriptive issue text configuration block enforced from 10 floor up to 2000 ceiling characters.
 * @property {string} [role] - Optional choice indicator restricted exactly to enum indicators ("mentor", "mentee", "user").
 */
const createSupportMessageSchema = Joi.object({
    email: Joi.string().email().required(),
    subject: Joi.string().min(3).max(200).required(),
    message: Joi.string().min(10).max(2000).required(),
    role: Joi.string().valid("mentor", "mentee", "user").optional(),
});

module.exports = { createSupportMessageSchema };