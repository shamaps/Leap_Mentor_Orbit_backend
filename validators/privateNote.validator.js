const Joi = require("joi");

/**
 * Joi boundary parser schemas validating fields during fresh personal notes additions.
 * @type {Joi.ObjectSchema}
 * @property {string} connectRequestId - 24-character hexadecimal tracking parameter key string matching MongoDB ObjectId specifications.
 * @property {string} [title] - Optional label adjustments bound up to a max length of 200 character elements.
 * @property {string} [content] - Optional core details block text description allowing limits up to 10000 items.
 */
const createNoteSchema = Joi.object({
    connectRequestId: Joi.string().hex().length(24).required(),
    title: Joi.string().max(200).allow("").optional(),
    content: Joi.string().max(10000).allow("").optional(),
});

/**
 * Joi parsing validator checking modification vectors targeted at specific notebook nodes.
 * Requires a minimum of 1 field populated inside delta updates payload structures.
 * @type {Joi.ObjectSchema}
 * @property {string} [title] - Optional title label reconfiguration capped up to 200 characters max limits.
 * @property {string} [content] - Optional descriptive summary adjustments text capped at 10000 items.
 */
const updateNoteSchema = Joi.object({
    title: Joi.string().max(200).allow("").optional(),
    content: Joi.string().max(10000).allow("").optional(),
}).min(1);

module.exports = { createNoteSchema, updateNoteSchema };