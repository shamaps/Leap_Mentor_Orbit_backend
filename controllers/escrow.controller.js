// backend/controllers/earnings.controller.js
const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");

/**
 * @typedef {Object} EscrowService
 * @property {(params: Object) => Promise<Object>} pay
 * @property {(params: Object) => Promise<Object>} release
 * @property {(params: Object) => Promise<Object>} refund
 * @property {(params: Object) => Promise<Object>} getStatus
 * @property {(userId: any) => Promise<Object>} getMyWallet
 * @property {(params: Object) => Promise<Object>} payAdditional
 * @property {() => Promise<{commissionRate: number}>} getCommissionRate
 */

/**
 * Factory assembling presenting layer controllers handling HTTP network orchestration routing for escrow movements.
 * * @param {EscrowService} escrowService - Core transactional infrastructure orchestration worker.
 * @param {{ logger: Object }} dependencies - Metric context instrumentation modules mapping parameters.
 * @returns {Object} Grouped controller endpoints route callback actions.
 */
const createEscrowController = (escrowService, { logger }) => {

  /**
   * Express API route handler locking tokens inside secure holds relative to accepted connect agreements.
   * * @async
   * @function pay
   * @param {import('express').Request & { user: { _id: any } }} req - Input request message envelope parsing body criteria.
   * @param {import('express').Response} res - Outbound data transport closure adapter channel.
   */
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
      return ok(res, { message: "Payment successful. Tokens locked in escrow.", ...result });
    } catch (err) {
      return handleError(res, err, "Escrow pay");
    }
  };

  /**
   * Express API route handler triggering release allocations toward host providers upon fulfillment confirmation.
   * * @async
   * @function release
   * @param {import('express').Request & { user: { _id: any } }} req - Network parsing frame isolating tracking param pointers.
   * @param {import('express').Response} res - Standard pipeline return connector socket.
   */
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
      return ok(res, { message: "Session marked complete. Tokens released to mentor.", ...result });
    } catch (err) {
      return handleError(res, err, "Escrow release");
    }
  };

  /**
   * Express API route handler driving reversion procedures returning funds back to target origin accounts.
   * * @async
   * @function refund
   * @param {import('express').Request & { user: { _id: any } }} req - Dynamic framework input request context container.
   * @param {import('express').Response} res - Operational execution result interface socket pipeline.
   */
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
      return ok(res, { message: "Escrow refunded successfully. Tokens returned to mentee.", ...result });
    } catch (err) {
      return handleError(res, err, "Escrow refund");
    }
  };

  /**
   * Express API route handler collecting status summaries specific to targeted interactions.
   * * @async
   * @function getStatus
   * @param {import('express').Request & { user: { _id: any } }} req - Inbound transaction parameters mapping variable context.
   * @param {import('express').Response} res - Standard connection return interface socket.
   */
  const getStatus = async (req, res) => {
    try {
      const result = await escrowService.getStatus({
        requestId: req.params.requestId,
        userId: req.user._id,
      });
      logger.info("getStatus completed successfully");
      return ok(res, result);
    } catch (err) {
      return handleError(res, err, "Escrow status");
    }
  };

  /**
   * Express API route handler exposing structural asset values recorded under current session credentials.
   * * @async
   * @function getMyWallet
   * @param {import('express').Request & { user: { _id: any } }} req - Request block tracking active context references.
   * @param {import('express').Response} res - Data output channel connector adapter.
   */
  const getMyWallet = async (req, res) => {
    try {
      const result = await escrowService.getMyWallet(req.user._id);
      logger.info("getMyWallet completed successfully");
      return ok(res, result);
    } catch (err) {
      return handleError(res, err, "Escrow getMyWallet");
    }
  };

  /**
   * Express API route handler provisioning independent locks for dynamic intermediate schedule entries.
   * * @async
   * @function payAdditional
   * @param {import('express').Request & { user: { _id: any } }} req - Intake parameters block mapping variable inputs.
   * @param {import('express').Response} res - Final payload interface output transport channel.
   */
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
      return ok(res, { message: "Additional session payment successful. Tokens locked in escrow.", ...result });
    } catch (err) {
      return handleError(res, err, "Escrow payAdditional");
    }
  };

  /**
   * Express API route handler extracting current system baseline cut rules metrics.
   * * @async
   * @function getCommissionRate
   * @param {import('express').Request} _req - Disregarded request transport framework container.
   * @param {import('express').Response} res - Structural data transmission output closure.
   */
  const getCommissionRate = async (_req, res) => {
    try {
      const result = await escrowService.getCommissionRate();
      logger.info("getCommissionRate completed successfully");
      return ok(res, result);
    } catch (err) {
      return handleError(res, err, "Escrow getCommissionRate");
    }
  };

  return { pay, release, refund, getStatus, getMyWallet, payAdditional, getCommissionRate };
};

module.exports = createEscrowController;