// middleware/validate.js
const AppError = require("../utils/appError");

/**
 * Express middleware factory for Joi schema validation.
 * Validates req.body against schema.
 * Returns 400 with field-level errors on failure.
 */
const validate = (schema) => (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
        abortEarly: false,     // collect ALL errors, not just first
        stripUnknown: true,    // remove extra fields not in schema
    });

    if (error) {
        const messages = error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message.replace(/['"]/g, ""),
        }));
        return res.status(400).json({ success: false, errors: messages });
    }

    req.body = value;  // use the validated + sanitized value
    next();
};

module.exports = validate;