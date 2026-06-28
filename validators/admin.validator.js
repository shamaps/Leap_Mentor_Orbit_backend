const Joi = require("joi");

const adminLoginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

const getUsersQuerySchema = Joi.object({
    search: Joi.string().max(100).allow("").optional(),
    role: Joi.string().valid("mentor", "mentee").allow("").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    deleted: Joi.string().valid("true", "false").optional(),
});
module.exports = { adminLoginSchema,getUsersQuerySchema };