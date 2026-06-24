// backend/routes/escrow.routes.js
const express = require("express");
const router = express.Router();
const validate = require("../middleware/validate");
const { paySchema, escrowActionSchema } = require("../validators/escrow.validator");
const { authenticate, requireRole } = require("../middleware/authenticate");
const { escrowController } = require("../config/container");
const {
    pay, release, refund, getStatus, getMyWallet, payAdditional, getCommissionRate,
} = escrowController;
// All escrow routes are protected
router.use(authenticate);

// POST /api/escrow/pay
// Mentee locks tokens into escrow after request is accepted
router.post("/pay", requireRole("mentee"), validate(paySchema), pay);

// GET /api/escrow/commission-rate
// Both roles can read the platform commission rate
router.get("/commission-rate", getCommissionRate);

// PATCH /api/escrow/:requestId
// Mentee confirms session complete { action: "release" } — tokens released to mentor
// Either party cancels { action: "refund" } — tokens returned to mentee
router.patch("/:requestId", requireRole("mentor", "mentee"), validate(escrowActionSchema), (req, res, next) => {
    const { action } = req.body;
    if (action === "release") return release(req, res, next);
    if (action === "refund") return refund(req, res, next);
    return res.status(400).json({ message: 'Invalid action. Use "release" or "refund".' });
});

// GET /api/escrow/status/:requestId
// Get payment + escrow status for a connect request
router.get("/status/:requestId", requireRole("mentor", "mentee"), getStatus);

// GET /api/escrow/wallet
// Get logged in user's wallet balance
router.get("/wallet", requireRole("mentor", "mentee"), getMyWallet);

// POST /api/escrow/pay-additional
// Mentee locks tokens for a single additional session slot
router.post("/pay-additional", requireRole("mentee"), payAdditional);

module.exports = router;