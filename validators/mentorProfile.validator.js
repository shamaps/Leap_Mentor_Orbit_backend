const Joi = require("joi");

const COMM_PREFS = ["Chat", "Email", "Video Call", "Phone Call", "In-Person"];

/**
 * Joi schematic framework parsing criteria boundaries for mentor profile parameters.
 * @type {Joi.ObjectSchema}
 * @property {string} [currentRole] - Bounded string layout configuration capped at 100 character elements.
 * @property {string} [industry] - Bounded category string configuration capped at 100 max limits.
 * @property {string} [company] - Corporate literal labeling text limited up to 100 elements.
 * @property {string} [bio] - Extended descriptive biographical parameters text capped at 1000 items.
 * @property {number} [yearsOfExperience] - Experience index boundary checked between 0 and 60 points.
 * @property {number} [hourlyRate] - Price limit threshold checking configuration, minimum 0 tokens.
 * @property {Joi.ArraySchema} [skills] - Array collection grouping loose capability strings.
 * @property {Joi.ArraySchema} [communicationPreferences] - Choice configurations restricted to the explicit COMM_PREFS array.
 * @property {Joi.ArraySchema} [languages] - Collection array matching language specification string names.
 * @property {string} [linkedInUrl] - Verified network URI string validation layout criteria.
 * @property {string} [portfolioUrl] - Verified workspace URI string validation layout criteria.
 * @property {string} [profilePicture] - Avatar hosting resource index checked up to 2048 characters max.
 * @property {string} [phoneNumber] - Textual numeric communication variable capped at 20 string elements.
 */
const profileSchema = Joi.object({
    currentRole: Joi.string().trim().max(100).allow("").optional(),
    industry: Joi.string().trim().max(100).allow("").optional(),
    company: Joi.string().trim().max(100).allow("").optional(),
    bio: Joi.string().trim().max(1000).allow("").optional(),
    yearsOfExperience: Joi.number().min(0).max(60).optional(),
    hourlyRate: Joi.number().min(0).optional(),
    skills: Joi.array().items(Joi.string()).optional(),
    communicationPreferences: Joi.array().items(Joi.string().valid(...COMM_PREFS)).optional(),
    languages: Joi.array().items(Joi.string()).optional(),
    linkedInUrl: Joi.string().uri().allow("").optional(),
    portfolioUrl: Joi.string().uri().allow("").optional(),
    profilePicture: Joi.string().max(2048).allow("").optional(),
    phoneNumber: Joi.string().max(20).allow("").optional(),
});

module.exports = { profileSchema };