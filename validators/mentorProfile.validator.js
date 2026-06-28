const Joi = require("joi");

const COMM_PREFS = ["Chat", "Email", "Video Call", "Phone Call", "In-Person"];

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