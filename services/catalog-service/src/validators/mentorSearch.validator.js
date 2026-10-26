// validators/mentorSearch.validator.js:
const Joi = require("joi");

/**
 * Joi parsing framework structural validator enforcing boundary schemas over public search route inputs.
 * @type {Joi.ObjectSchema}
 * @property {string} [q] - Optional literal search text payload argument checked up to 100 character limits.
 * @property {string} [industry] - Optional classification text parameter capped at 100 string elements.
 * @property {string} [skills] - Optional tag string target validation context tracking max limits of 200 items.
 * @property {number} [page] - Optional pagination index target selector checking a minimum value floor of 1.
 * @property {number} [limit] - Optional layout sizing element integer checking boundaries between 1 and 50 points.
 */
const searchQuerySchema = Joi.object({
    q: Joi.string().max(100).allow("").optional(),
    industry: Joi.string().max(100).allow("").optional(),
    skills: Joi.string().max(200).allow("").optional(),
    page: Joi.number().integer().min(1).optional(),
    limit: Joi.number().integer().min(1).max(50).optional(),
});

module.exports = { searchQuerySchema };