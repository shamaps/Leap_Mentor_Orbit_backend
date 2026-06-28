const Joi = require("joi");

const submitFeedbackSchema = Joi.object({
    connectRequestId: Joi.string().hex().length(24).required(),
    rating: Joi.number().min(1).max(5).required(),
    comment: Joi.string().max(1000).allow("").optional(), // no min — allow empty
    slotIndex: Joi.number().integer().min(0).optional(),  // frontend sends this
});

module.exports = { submitFeedbackSchema };