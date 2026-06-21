// validators/auth.validator.js
const Joi = require("joi");

const registerSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().lowercase().required(),
    password: Joi.string().min(8).max(128).required(),
    roles: Joi.array()
        .items(Joi.string().valid("mentor", "mentee"))
        .length(1)
        .required(),
    termsAccepted: Joi.boolean().valid(true).required()
        .messages({ "any.only": "You must accept terms to continue" }),
});

const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
});

const verifyOtpSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
});

// reset-password sends { email, otp, newPassword } — NOT a token
const resetPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
    newPassword: Joi.string().min(8).max(128).required(),
});

module.exports = {
    registerSchema,
    loginSchema,
    forgotPasswordSchema,
    verifyOtpSchema,
    resetPasswordSchema,
};