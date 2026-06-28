const Joi = require("joi");

const createNoteSchema = Joi.object({
    connectRequestId: Joi.string().hex().length(24).required(),
    title: Joi.string().max(200).allow("").optional(),
    content: Joi.string().max(10000).allow("").optional(),
});

const updateNoteSchema = Joi.object({
    title: Joi.string().max(200).allow("").optional(),
    content: Joi.string().max(10000).allow("").optional(),
}).min(1);

module.exports = { createNoteSchema, updateNoteSchema };