const Joi = require("joi");

const changePasswordSchema = Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(6).max(128).required(),
});

const addAdminSchema = Joi.object({
    name: Joi.string().trim().min(2).max(100).required(),
    email: Joi.string().email().lowercase().required(),
});

const updateCommissionSchema = Joi.object({
    commissionRate: Joi.number().min(0).max(100).required(),
});

module.exports = { changePasswordSchema, addAdminSchema, updateCommissionSchema };