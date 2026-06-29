// backend/controllers/earnings.controller.js
const { handleError } = require("../utils/appError");
const { ok } = require("../utils/response");

/**
 * @typedef {Object} EarningsService
 * @property {(mentorId: string) => Promise<Object>} getEarningsSummary
 * @property {(mentorId: string, period: string) => Promise<Object>} getEarningsChart
 * @property {(mentorId: string, queryParams: Object) => Promise<Object>} getPayoutHistory
 */

/**
 * @typedef {Object} WalletWithdrawalService
 * @property {(mentorId: string) => Promise<Object>} withdrawEarnings
 */

/**
 * Factory assembling presentation entry controllers handling routing requests for monitoring financials.
 * * @param {EarningsService} earningsService - Operational worker module aggregating revenue configurations.
 * @param {WalletWithdrawalService} walletWithdrawalService - Operational execution service processing withdrawal settlements.
 * @param {{ logger: Logger }} dependencies - Performance logging analytics capture tool.
 * @returns {Object} Grouped Express endpoints callbacks map configuration.
 */
const createEarningsController = (earningsService, walletWithdrawalService, { logger }) => {

  /**
   * Express Route handler parsing total capture balances to build display summary card elements.
   * * @async
   * @function getEarningsSummary
   * @param {import('express').Request & { user: { _id: string } }} req - Augmented input framework request containing user session data.
   * @param {import('express').Response} res - Standard output response transport pipe layer.
   */
  const getEarningsSummary = async (req, res) => {
    try {
      const data = await earningsService.getEarningsSummary(req.user._id);
      logger.info("earnings.controller completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "earnings.getEarningsSummary");
    }
  };

  /**
   * Express Route handler mapping chronological earnings splits formatted for graphing tools.
   * * @async
   * @function getEarningsChart
   * @param {import('express').Request & { user: { _id: string }, query: { period?: string } }} req - Input message envelope parsing parameters.
   * @param {import('express').Response} res - Data output channel handler.
   */
  const getEarningsChart = async (req, res) => {
    try {
      const data = await earningsService.getEarningsChart(req.user._id, req.query.period);
      logger.info("earnings.controller completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "earnings.getEarningsChart");
    }
  };

  /**
   * Express Route handler displaying paginated history records capturing completed platform transfers.
   * * @async
   * @function getPayoutHistory
   * @param {import('express').Request & { user: { _id: string } }} req - Network frame context parameter holder wrapper.
   * @param {import('express').Response} res - Dispatched result data transport connection closure.
   */
  const getPayoutHistory = async (req, res) => {
    try {
      const data = await earningsService.getPayoutHistory(req.user._id, req.query);
      logger.info("earnings.controller completed successfully");
      return ok(res, data);
    } catch (err) {
      return handleError(res, err, "earnings.getPayoutHistory");
    }
  };

  /**
   * Express Route handler executing manual balance payout transfers toward recorded outbound account targets.
   * * @async
   * @function withdrawEarnings
   * @param {import('express').Request & { user: { _id: string } }} req - Active secure validation connection transaction request.
   * @param {import('express').Response} res - Transport response pipe adapter.
   */
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