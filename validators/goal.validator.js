const Joi = require("joi");

/**
 * Joi parsing logic boundary checking presentation parameter criteria blocks for goal creation.
 * @type {Joi.ObjectSchema}
 * @property {string} connectRequestId - 24-character hexadecimal tracking parameter key string matching MongoDB ObjectId specifications.
 * @property {string} title - Core objective character sequence bounded strictly between 2 and 200 elements.
 * @property {string} [description] - Optional details tracking context block allowing text limits up to 1000 characters.
 */
const createGoalSchema = Joi.object({
    connectRequestId: Joi.string().hex().length(24).required(),
    title: Joi.string().min(2).max(200).required(),
    description: Joi.string().max(1000).allow("").optional(),
});

/**
 * Joi schematic evaluation wrapper governing structural changes to existing goal data rows.
 * @type {Joi.ObjectSchema}
 * @property {string} [title] - Optional label adjustments bound between 2 and 200 characters.
 * @property {string} [description] - Optional descriptional adjustments up to 1000 character boundaries.
 * @property {string} [status] - Optional condition choice selection limited exactly to enum values ("active", "completed", "abandoned").
 */
const updateGoalSchema = Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    description: Joi.string().max(1000).allow("").optional(),
    status: Joi.string().valid("active", "completed", "abandoned").optional(),
});

/**
 * Joi data formatting boundary schema validating milestone node additions.
 * @type {Joi.ObjectSchema}
 * @property {string} title - Core node title string sequence between 2 and 200 characters long.
 * @property {string} [dueDate] - Optional calendar constraint tracking variable validated against ISO-8601 date specifications.
 */
const milestoneSchema = Joi.object({
    title: Joi.string().min(2).max(200).required(),
    dueDate: Joi.string().isoDate().optional(),
});

/**
 * Joi parsing framework validator checking modification vectors targeted at specific milestone components.
 * @type {Joi.ObjectSchema}
 * @property {string} [title] - Optional literal string label re-configuration between 2 and 200 items length.
 * @property {boolean} [completed] - Optional evaluation flag checking logical progress transitions.
 * @property {string} [dueDate] - Optional dynamic target boundary calendar parameter adhering to ISO date standards.
 */
const updateMilestoneSchema = Joi.object({
    title: Joi.string().min(2).max(200).optional(),
    completed: Joi.boolean().optional(),
    dueDate: Joi.string().isoDate().optional(),
});

module.exports = { createGoalSchema, updateGoalSchema, milestoneSchema, updateMilestoneSchema };