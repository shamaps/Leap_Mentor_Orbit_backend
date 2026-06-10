// backend/controllers/earnings.controller.js
const earningsService = require("../services/earnings.service");

const { logger } = require("@sentry/node");
// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings
// Stat cards — totalEarnings, sessionsThisMonth, avgRating, pendingPayout
// ─────────────────────────────────────────────────────────────
const getEarningsSummary = async (req, res) => {
  try {
    const data = await earningsService.getEarningsSummary(req.user._id);
    logger.info("earnings.controller completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings/chart?period=monthly|weekly
// Chart data — grouped earnings
// ─────────────────────────────────────────────────────────────
const getEarningsChart = async (req, res) => {
  try {
    const data = await earningsService.getEarningsChart(req.user._id, req.query.period);
    logger.info("earnings.controller completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/mentor/earnings/payouts?page=1&limit=10&search=
// Payout history table — paginated + searchable
// ─────────────────────────────────────────────────────────────
const getPayoutHistory = async (req, res) => {
  try {
    const data = await earningsService.getPayoutHistory(req.user._id, req.query);
    logger.info("earnings.controller completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(500).json({ message: err.message });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/mentor/earnings/withdraw
// Withdraw available balance
// ─────────────────────────────────────────────────────────────
const withdrawEarnings = async (req, res) => {
  try {
    const data = await earningsService.withdrawEarnings(req.user._id);
    logger.info("withdrawEarnings completed successfully");
    return res.json({ success: true, ...data });
  } catch (err) {
    const status = err.statusCode || 500;
    logger.error("Unhandled error in earnings.controller", { error: err.message, stack: err.stack });
    return res.status(status).json({ message: err.message });
  }
};

module.exports = {
  getEarningsSummary,
  getEarningsChart,
  getPayoutHistory,
  withdrawEarnings,
};