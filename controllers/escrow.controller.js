// backend/controllers/escrow.controller.js
const AppError = require("../utils/AppError");
const escrowService = require("../services/escrow.service");

// ── Centralised error handler ─────────────────────────────────
const handleError = (res, err, label) => {
  if (err instanceof AppError)
    return res.status(err.status).json({ message: err.message });
  console.error(`❌ ${label} error:`, err);
  return res.status(500).json({ message: err.message });
};

// ─────────────────────────────────────────────────────────────
// POST /api/escrow/pay
// ─────────────────────────────────────────────────────────────
const pay = async (req, res) => {
  try {
    const result = await escrowService.pay({
      ...req.body,
      menteeId: req.user._id,
    });
    return res.status(200).json({ message: "Payment successful. Tokens locked in escrow.", ...result });
  } catch (err) {
    return handleError(res, err, "Escrow pay");
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/escrow/release/:requestId
// ─────────────────────────────────────────────────────────────
const release = async (req, res) => {
  try {
    const result = await escrowService.release({
      requestId: req.params.requestId,
      menteeId: req.user._id,
    });
    return res.status(200).json({ message: "Session marked complete. Tokens released to mentor.", ...result });
  } catch (err) {
    return handleError(res, err, "Escrow release");
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/escrow/refund/:requestId
// ─────────────────────────────────────────────────────────────
const refund = async (req, res) => {
  try {
    const result = await escrowService.refund({
      requestId: req.params.requestId,
      userId: req.user._id,
    });
    return res.status(200).json({ message: "Escrow refunded successfully. Tokens returned to mentee.", ...result });
  } catch (err) {
    return handleError(res, err, "Escrow refund");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/escrow/status/:requestId
// ─────────────────────────────────────────────────────────────
const getStatus = async (req, res) => {
  try {
    const result = await escrowService.getStatus({
      requestId: req.params.requestId,
      userId: req.user._id,
    });
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, "Escrow status");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/escrow/wallet
// ─────────────────────────────────────────────────────────────
const getMyWallet = async (req, res) => {
  try {
    const result = await escrowService.getMyWallet(req.user._id);
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, "Escrow getMyWallet");
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/escrow/pay-additional
// ─────────────────────────────────────────────────────────────
const payAdditional = async (req, res) => {
  try {
    const result = await escrowService.payAdditional({
      ...req.body,
      menteeId: req.user._id,
    });
    return res.status(200).json({ message: "Additional session payment successful. Tokens locked in escrow.", ...result });
  } catch (err) {
    return handleError(res, err, "Escrow payAdditional");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/escrow/commission-rate
// ─────────────────────────────────────────────────────────────
const getCommissionRate = async (_req, res) => {
  try {
    const result = await escrowService.getCommissionRate();
    return res.status(200).json(result);
  } catch (err) {
    return handleError(res, err, "Escrow getCommissionRate");
  }
};

module.exports = { pay, payAdditional, release, refund, getStatus, getMyWallet, getCommissionRate };