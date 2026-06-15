// backend/controllers/admin/adminPayments.controller.js
const adminPaymentsService = require("../../services/adminPayments.service");
const { handleError } = require("../../utils/AppError");
const logger = require("../../utils/logger");
// ─────────────────────────────────────────────────────────────
// GET /api/admin/payments/stats
// ─────────────────────────────────────────────────────────────
const getPaymentStats = async (req, res) => {
  try {
    const data = await adminPaymentsService.fetchPaymentStats(req.admin._id);
    logger.info("getPaymentStats completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err, "adminPayments.getPaymentStats");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/payments/chart
// ─────────────────────────────────────────────────────────────
const getRevenueChart = async (_req, res) => {
  try {
    const data = await adminPaymentsService.fetchRevenueChart();
    logger.info("getRevenueChart completed successfully");
    return res.json({ success: true, data });
  } catch (err) {
    return handleError(res, err, "adminPayments.getRevenueChart");
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/admin/payments/transactions
// ─────────────────────────────────────────────────────────────
const getTransactions = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page) || 1);
    const limit = Math.min(20, Number.parseInt(req.query.limit) || 10);
    const search = req.query.search?.trim() || "";
    const type = req.query.type?.trim() || "";

    const data = await adminPaymentsService.fetchTransactions({ page, limit, search, type });
    logger.info("getTransactions completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    return handleError(res, err, "adminPayments.getTransactions");
  }
};

module.exports = { getPaymentStats, getRevenueChart, getTransactions };