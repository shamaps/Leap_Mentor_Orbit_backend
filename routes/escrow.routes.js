// backend/routes/escrow.routes.js
const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/authenticate");
const { pay, release, refund, getStatus, getMyWallet, payAdditional, getCommissionRate } = require("../controllers/escrow.controller");

// All escrow routes are protected
router.use(authenticate);

// POST /api/escrow/pay
// Mentee locks tokens into escrow after request is accepted
router.post("/pay", pay);

// POST /api/escrow/release/:requestId
// Mentee confirms session complete — tokens released to mentor
router.post("/release/:requestId", release);
// GET /api/escrow/commission-rate
router.get("/commission-rate", getCommissionRate);
// POST /api/escrow/refund/:requestId
// Either party cancels — tokens returned to mentee
router.post("/refund/:requestId", refund);

// GET /api/escrow/status/:requestId
// Get payment + escrow status for a connect request
router.get("/status/:requestId", getStatus);

// GET /api/escrow/wallet
// Get logged in user's wallet balance
router.get("/wallet", getMyWallet);

// POST /api/escrow/pay-additional
// Mentee locks tokens for a single additional session slot
router.post("/pay-additional", payAdditional);

module.exports = router;