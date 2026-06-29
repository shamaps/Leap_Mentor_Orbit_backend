const Joi = require("joi");

/**
 * Joi validation schema for password changes.
 * @type {Joi.ObjectSchema}
 * @property {string} currentPassword - Required current password.
 * @property {string} newPassword - Required new password, between 6 and 128 characters.
 */
const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(128).required(),
});

/**
 * Joi validation schema for generating a new admin profile.
 * @type {Joi.ObjectSchema}
 * @property {string} name - Trimmed, required name (2-100 characters).
 * @property {string} email - Validated, lowercased, required email address.
 */
const addAdminSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().lowercase().required(),
});

/**
 * Joi validation schema for modifying platform fee distributions.
 * @type {Joi.ObjectSchema}
 * @property {number} commissionRate - Required number bound between 0 and 100.
 */
const updateCommissionSchema = Joi.object({
    commissionRate: Joi.number().min(0).max(100).required(),
});

module.exports = { changePasswordSchema, addAdminSchema, updateCommissionSchema };