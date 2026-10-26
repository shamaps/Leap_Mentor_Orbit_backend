// services/payments-service/src/routes/internal.routes.js
const express = require("express");
const { requireInternalAuth } = require("@leapmentor/shared/middleware/internalAuth");
const { handleError } = require("@leapmentor/shared/utils/appError");
const { internalEscrowService, walletOperationsService } = require("../config/container");
const { holdSchema, releaseSchema, refundSlotSchema } = require("../validators/internalEscrow.validator");
const Joi = require("joi");

const router = express.Router();

router.use(requireInternalAuth({ service: "payments", callers: ["engagement"] }));

router.get("/ping", (req, res) => {
    res.json({
        success: true,
        service: "payments",
        caller: req.internalCaller,
        traceId: req.traceId,
        time: new Date().toISOString(),
    });
});

const validate = (schema, req, res) => {
    const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
    if (error) {
        res.status(400).json({ success: false, message: error.details.map((detail) => detail.message).join("; ") });
        return null;
    }
    return value;
};
const validRequestId = (requestId, res, field = "requestId") => {
    const { error } = Joi.string().hex().length(24).required().validate(requestId);
    if (!error) return true;
    res.status(400).json({ success: false, message: `${field} must be a valid MongoDB ObjectId` });
    return false;
};

router.post("/escrows/:requestId/hold", async (req, res) => {
    if (!validRequestId(req.params.requestId, res)) return;
    const body = validate(holdSchema, req, res);
    if (!body) return;
    try {
        const result = await internalEscrowService.hold({ requestId: req.params.requestId, ...body });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return handleError(res, err, "internal escrow hold");
    }
});

router.post("/escrows/:requestId/release", async (req, res) => {
    if (!validRequestId(req.params.requestId, res)) return;
    const body = validate(releaseSchema, req, res);
    if (!body) return;
    try {
        const result = await internalEscrowService.release({ requestId: req.params.requestId, ...body });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return handleError(res, err, "internal escrow release");
    }
});

router.post("/escrows/:requestId/slots/:slotIndex/refund", async (req, res) => {
    if (!validRequestId(req.params.requestId, res)) return;
    const body = validate(refundSlotSchema, req, res);
    if (!body) return;
    const slotIndex = Number(req.params.slotIndex);
    if (!Number.isInteger(slotIndex) || slotIndex < 0) {
        return res.status(400).json({ success: false, message: "slotIndex must be a non-negative integer" });
    }
    try {
        const result = await internalEscrowService.refundSlot({ requestId: req.params.requestId, slotIndex, ...body });
        return res.status(200).json({ success: true, data: result });
    } catch (err) {
        return handleError(res, err, "internal escrow slot refund");
    }
});

router.get("/wallets/:userId/balance", async (req, res) => {
    if (!validRequestId(req.params.userId, res, "userId")) return;
    try {
        const data = await walletOperationsService.getBalance(req.params.userId);
        return res.json({ success: true, data });
    } catch (err) {
        return handleError(res, err, "internal wallet balance");
    }
});

router.post("/wallets/:userId/leap-refills", async (req, res) => {
    if (!validRequestId(req.params.userId, res, "userId")) return;
    const body = validate(Joi.object({ requestId: Joi.string().hex().length(24).required() }), req, res);
    if (!body) return;
    try {
        const data = await walletOperationsService.issueLeapRefill({ userId: req.params.userId, requestId: body.requestId });
        return res.json({ success: true, data });
    } catch (err) {
        return handleError(res, err, "internal wallet leap refill");
    }
});

module.exports = router;
