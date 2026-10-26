// middleware/validate.js
const logger = require("../utils/logger");

/**
 * Custom celebrate-equivalent middleware for Joi schema validation.
 * Functionally identical to the `celebrate` npm package but without
 * the additional dependency. Validates req.body, strips unknown fields,
 * and returns field-level 400 errors on failure.
 *
 * Usage: router.post("/route", validate(schema), controller)
 */
/**
 * Express middleware factory for Joi schema validation.
 * Validates req.body against schema.
 * Returns 400 with field-level errors on failure.
 */
const validate = (schema, source = "body") => (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
        abortEarly: false,
        stripUnknown: true,
    });

    if (error) {
        const messages = error.details.map((d) => ({
            field: d.path.join("."),
            message: d.message.replaceAll(/['"]/g, ""),
        }));
        logger.warn("Validation failed", {
            path: req.path,
            method: req.method,
            errors: messages,
        });
        return res.status(400).json({ success: false, errors: messages });
    }

    req[source] = value;
    next();
};

module.exports = validate;