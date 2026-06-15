// backend/controllers/escrow.controller.js
const AppError = require("../utils/AppError");
const escrowService = require("../services/escrow.service");
const logger = require("../utils/logger");
const { handleError } = require("../utils/AppError");

// POST /api/escrow/pay
const pay = async (req, res) => {
  try {
    const result = await escrowService.pay({
      ...req.body,
      menteeId: req.user._id,
    });
    logger.info("Escrow pay successful", {
      menteeId: req.user._id.toString(),
      connectRequestId: req.body.connectRequestId,
      totalAmount: result.totalAmount,
      platformFee: result.platformFee,
    });
    logger.info("pay completed successfully");
    return res.status(200).json({ message: "Payment successful. Tokens locked in escrow.", ...result });
  } catch (err) {
    logger.error("Unhandled error in escrow.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "Escrow pay");
  }
};

// POST /api/escrow/release/:requestId
const release = async (req, res) => {
  try {
    const result = await escrowService.release({
      requestId: req.params.requestId,
      menteeId: req.user._id,
    });
    logger.info("Escrow release successful", {
      menteeId: req.user._id.toString(),
      requestId: req.params.requestId,
      totalAmount: result.totalAmount,
      mentorPayout: result.mentorPayout,
      commissionAmount: result.commissionAmount,
    });
    logger.info("release completed successfully");
    return res.status(200).json({ message: "Session marked complete. Tokens released to mentor.", ...result });
  } catch (err) {
    logger.error("Unhandled error in escrow.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "Escrow release");
  }
};

// POST /api/escrow/refund/:requestId
const refund = async (req, res) => {
  try {
    const result = await escrowService.refund({
      requestId: req.params.requestId,
      userId: req.user._id,
    });
    logger.info("Escrow refund successful", {
      userId: req.user._id.toString(),
      requestId: req.params.requestId,
      totalAmount: result.totalAmount,
    });
    return res.status(200).json({ message: "Escrow refunded successfully. Tokens returned to mentee.", ...result });
  } catch (err) {
    logger.error("Unhandled error in escrow.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "Escrow refund");
  }
};

// GET /api/escrow/status/:requestId
const getStatus = async (req, res) => {
  try {
    const result = await escrowService.getStatus({
      requestId: req.params.requestId,
      userId: req.user._id,
    });
    logger.info("getStatus completed successfully");
    return res.status(200).json(result);
  } catch (err) {
    logger.error("Unhandled error in escrow.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "Escrow status");
  }
};

// GET /api/escrow/wallet
const getMyWallet = async (req, res) => {
  try {
    const result = await escrowService.getMyWallet(req.user._id);
    logger.info("getMyWallet completed successfully");
    return res.status(200).json(result);
  } catch (err) {
    logger.error("Unhandled error in escrow.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "Escrow getMyWallet");
  }
};

// POST /api/escrow/pay-additional
const payAdditional = async (req, res) => {
  try {
    const result = await escrowService.payAdditional({
      ...req.body,
      menteeId: req.user._id,
    });
    logger.info("Escrow additional payment successful", {
      menteeId: req.user._id.toString(),
      connectRequestId: req.body.connectRequestId,
      slotId: req.body.slotId,
      totalAmount: result.totalAmount,
    });
    logger.info("payAdditional completed successfully");
    return res.status(200).json({ message: "Additional session payment successful. Tokens locked in escrow.", ...result });
  } catch (err) {
    logger.error("Unhandled error in escrow.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "Escrow payAdditional");
  }
};

// GET /api/escrow/commission-rate
const getCommissionRate = async (_req, res) => {
  try {
    const result = await escrowService.getCommissionRate();
    logger.info("getCommissionRate completed successfully");
    return res.status(200).json(result);
  } catch (err) {
    logger.error("Unhandled error in escrow.controller", { error: err.message, stack: err.stack });
    return handleError(res, err, "Escrow getCommissionRate");
  }
};

module.exports = { pay, payAdditional, release, refund, getStatus, getMyWallet, getCommissionRate };