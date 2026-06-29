const Joi = require("joi");

/**
 * Joi schematic boundary parser confirming date and hour formatting parameters on dynamic slot additions.
 * @type {Joi.ObjectSchema}
 * @property {string} date - Calendar day string enforced strictly to a "YYYY-MM-DD" expression match.
 * @property {string} startTime - Operational timeline window lower boundary enforced as "HH:MM".
 * @property {string} endTime - Operational timeline window upper boundary enforced as "HH:MM".
 * @property {string} [day] - Optional textual weekday parameter label.
 */
const addSlotSchema = Joi.object({
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    day: Joi.string().optional(),
});

/**
 * Joi parsing logic checking string metrics verifying encrypted communication links.
 * @type {Joi.ObjectSchema}
 * @property {string} meetingLink - Mandatory external address string adhering strictly to "https" protocol schemes.
 */
const meetingLinkSchema = Joi.object({
    meetingLink: Joi.string().uri({ scheme: ["https"] }).required(),
});

/**
 * Joi schema checking state action transitions, conditionally enforcing secondary properties relative to custom modifiers.
 * @type {Joi.ObjectSchema}
 * @property {string} action - Explicit execution path token constraint limited to ("complete", "cancel", "reschedule").
 * @property {string} [reason] - Optional cancellation summary text capped at 500 characters, explicitly forbidden on alternative actions.
 * @property {string} [date] - Day match parameter string required only on "reschedule" selections.
 * @property {string} [startTime] - Starting window path required only on "reschedule" selections.
 * @property {string} [endTime] - Ending window path required only on "reschedule" selections.
 */
const selectSchemaProps = {
    action: Joi.string().valid("complete", "cancel", "reschedule").required(),
    reason: Joi.string().max(500).allow("").when("action", {
        is: "cancel", then: Joi.optional(), otherwise: Joi.forbidden(),
    }),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).when("action", {
        is: "reschedule", then: Joi.required(), otherwise: Joi.forbidden(),
    }),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).when("action", {
        is: "reschedule", then: Joi.required(), otherwise: Joi.forbidden(),
    }),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).when("action", {
        is: "reschedule", then: Joi.required(), otherwise: Joi.forbidden(),
    }),
};
const slotStatusSchema = Joi.object(selectSchemaProps);

module.exports = { addSlotSchema, meetingLinkSchema, slotStatusSchema };