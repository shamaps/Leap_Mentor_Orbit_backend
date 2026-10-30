// services/catalog-service/src/routes/internal.routes.js
const express = require("express");
const { requireInternalAuth } = require("@leapmentor/shared/middleware/internalAuth");
const Joi = require("joi");
const { internalOperationsService } = require("../config/container");
const AppError = require("@leapmentor/shared/utils/appError");
const { handleError } = require("@leapmentor/shared/utils/appError");

const router = express.Router();

router.use(requireInternalAuth({ service: "catalog", callers: ["engagement"] }));

router.get("/ping", (req, res) => {
    res.json({
        success: true,
        service: "catalog",
        caller: req.internalCaller,
        traceId: req.traceId,
        time: new Date().toISOString(),
    });
});

const validate = (schema) => (req, _res, next) => {
    const { error, value } = schema.validate({ ...req.body, ...req.params }, { abortEarly: false, stripUnknown: true });
    if (error) return next(new AppError(400, error.details.map((detail) => detail.message).join("; ")));
    req.internalInput = value;
    return next();
};
const objectId = Joi.string().hex().length(24);
const slotPayload = Joi.object({
    mentorId: objectId.required(), menteeId: objectId.required(),
    date: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required(),
    startTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
    endTime: Joi.string().pattern(/^\d{2}:\d{2}$/).required(),
});

const run = (operation) => async (req, res) => {
    try {
        const data = await operation(req.internalInput);
        return res.json({ success: true, data });
    } catch (error) {
        return handleError(res, error, `catalog.internal.${req.path}`);
    }
};

router.post("/slots/lock", validate(slotPayload), run((input) => internalOperationsService.lockSlot(input)));
router.post("/slots/release", validate(slotPayload), run((input) => internalOperationsService.releaseSlot(input)));
router.put("/mentors/:mentorId/rating", validate(Joi.object({
    mentorId: objectId.required(), avgRating: Joi.number().min(0).max(5).required(), ratingCount: Joi.number().integer().min(0).required(),
})), run((input) => internalOperationsService.updateMentorRating(input)));
router.post(
    "/mentors/:mentorId/completed-sessions",
    validate(Joi.object({
        mentorId: objectId.required(),
        requestId: objectId.required(),
    })),
    run((input) => internalOperationsService.recordCompletedSession(input))
);
router.get("/mentors/:mentorId/availability", validate(Joi.object({ mentorId: objectId.required() })), run((input) => internalOperationsService.getMentorAvailability(input.mentorId)));
module.exports = router;