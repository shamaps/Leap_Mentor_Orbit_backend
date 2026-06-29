// validators/auth.validator.js
const Joi = require("joi");

/**
 * Joi confirmation validation schema mapping structural parameters required for account sign up.
 * @type {import('joi').ObjectSchema}
 */
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
}).unknown(false);

/**
 * Joi verification constraints matching regular authentication requests.
 * @type {import('joi').ObjectSchema}
 */
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
});

/**
 * Joi schema verifying payload properties during password loss triggers.
 * @type {import('joi').ObjectSchema}
 */
const forgotPasswordSchema = Joi.object({
    email: Joi.string().email().required(),
});

/**
 * Joi evaluation requirements structural schema testing input codes.
 * @type {import('joi').ObjectSchema}
 */
const verifyOtpSchema = Joi.object({
    email: Joi.string().email().required(),
    otp: Joi.string().length(6).required(),
});

/**
 * Joi validation verification rules used during core user profile password reassignment resets.
 * Note: Uses transactional parameters { email, otp, newPassword } — NOT individual static authorization token items.
 * @type {import('joi').ObjectSchema}
 */
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