const Joi = require("joi");

const createSupportMessageSchema = Joi.object({
    email: Joi.string().email().required(),
    subject: Joi.string().min(3).max(200).required(),
    message: Joi.string().min(10).max(2000).required(),
    role: Joi.string().valid("mentor", "mentee", "user").optional(),
});

module.exports = { createSupportMessageSchema };