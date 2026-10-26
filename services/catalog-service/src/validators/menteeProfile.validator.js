const Joi = require("joi");

/**
 * Valid standard connection interaction choices.
 * @type {Array<string>}
 */
const COMM_PREFS = ["Chat", "Email", "Video Call", "Phone Call", "In-Person"];

/**
 * Joi validator configuration payload parsing optional metadata profile modifications for client types.
 * @type {import('joi').ObjectSchema}
 */
const profileSchema = Joi.object({
    currentRole: Joi.string().trim().max(100).allow("").optional(),
    industry: Joi.string().trim().max(100).allow("").optional(),
    company: Joi.string().trim().max(100).allow("").optional(),
    bio: Joi.string().trim().max(1000).allow("").optional(),
    yearsOfExperience: Joi.string().min(0).max(60).optional(),
    skills: Joi.array().items(Joi.string()).optional(),
    interestedFields: Joi.array().items(Joi.string()).optional(),
    communicationPreferences: Joi.array().items(Joi.string().valid(...COMM_PREFS)).optional(),
    languages: Joi.array().items(Joi.string()).optional(),
    linkedInUrl: Joi.string().uri().allow("").optional(),
    portfolioUrl: Joi.string().uri().allow("").optional(),
    profilePicture: Joi.string().max(2048).allow("").optional(),
});

module.exports = { profileSchema };