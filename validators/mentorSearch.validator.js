// validators/mentorSearch.validator.js:
const Joi = require("joi");

const searchQuerySchema = Joi.object({
    q: Joi.string().max(100).allow("").optional(),
    industry: Joi.string().max(100).allow("").optional(),
    skills: Joi.string().max(200).allow("").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
});
module.exports = { searchQuerySchema };