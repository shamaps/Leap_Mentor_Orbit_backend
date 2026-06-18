// backend/controllers/earnings.controller.js

const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");
const createEarningsController = (earningsService, walletWithdrawalService, { logger }) => {
// GET /api/mentor/earnings
// Stat cards — totalEarnings, sessionsThisMonth, avgRating, pendingPayout

const getEarningsSummary = async (req, res) => {
  try {
    const data = await earningsService.getEarningsSummary(req.user._id);
    logger.info("earnings.controller completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "earnings.getEarningsSummary");
  }
};

// GET /api/mentor/earnings/chart?period=monthly|weekly
// Chart data — grouped earnings

const getEarningsChart = async (req, res) => {
  try {
    const data = await earningsService.getEarningsChart(req.user._id, req.query.period);
    logger.info("earnings.controller completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "earnings.getEarningsChart");
  }
};


// GET /api/mentor/earnings/payouts?page=1&limit=10&search=
// Payout history table — paginated + searchable

const getPayoutHistory = async (req, res) => {
  try {
    const data = await earningsService.getPayoutHistory(req.user._id, req.query);
    logger.info("earnings.controller completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "earnings.getPayoutHistory");
  }
};


// POST /api/mentor/earnings/withdraw
// Withdraw available balance

const withdrawEarnings = async (req, res) => {
  try {
    const data = await walletWithdrawalService.withdrawEarnings(req.user._id);
    logger.info("withdrawEarnings completed successfully");
    return ok(res, data);
  } catch (err) {
    return handleError(res, err, "earnings.withdrawEarnings");
  }
};

  return { getEarningsSummary, getEarningsChart, getPayoutHistory, withdrawEarnings };
};
module.exports = createEarningsController;