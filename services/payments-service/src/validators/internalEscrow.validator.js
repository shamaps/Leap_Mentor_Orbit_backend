const Joi = require("joi");

const objectId = Joi.string().hex().length(24);
const holdSchema = Joi.object({
  menteeId: objectId.required(),
  mentorId: objectId.required(),
  sessionRate: Joi.number().min(1).required(),
  sessionCount: Joi.number().integer().min(1).required(),
});
const releaseSchema = Joi.object({ menteeId: objectId.optional() });
const refundSlotSchema = Joi.object({ cancelledBy: Joi.string().max(80).default("system") });

module.exports = { holdSchema, releaseSchema, refundSlotSchema };
