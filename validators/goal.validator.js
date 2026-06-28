const Joi = require("joi");

const createGoalSchema = Joi.object({
    connectRequestId: Joi.string().hex().length(24).required(),
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(1000).allow("").optional(),
});

const updateGoalSchema = Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    description: Joi.string().max(1000).allow("").optional(),
    status: Joi.string().valid("active", "completed", "abandoned").optional(),
});

const milestoneSchema = Joi.object({
    title: Joi.string().min(2).max(200).required(),
    dueDate: Joi.string().isoDate().optional(),
});

const updateMilestoneSchema = Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    completed: Joi.boolean().optional(),
    dueDate: Joi.string().isoDate().optional(),
});

module.exports = { createGoalSchema, updateGoalSchema, milestoneSchema, updateMilestoneSchema };