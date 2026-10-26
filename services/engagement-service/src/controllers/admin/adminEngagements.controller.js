// services/engagement-service/src/controllers/admin/adminEngagements.controller.js
const { ok } = require("@leapmentor/shared/utils/response");
const { handleError } = require("@leapmentor/shared/utils/appError");

/**
 * Creates the admin engagements controller.
 * @param {Object} adminEngagementsService - The service instance.
 * @param {Object} options
 * @param {Object} options.logger - Logger instance.
 */
const createAdminEngagementsController = (adminEngagementsService, { logger }) => {
    const getEngagementStats = async (_req, res) => {
        try {
            const data = await adminEngagementsService.fetchEngagementStats();
            logger.info("getEngagementStats completed successfully");
            return ok(res, data);
        } catch (err) {
            return handleError(res, err, "getEngagementStats");
        }
    };

    const getEngagements = async (req, res) => {
        try {
            const data = await adminEngagementsService.fetchEngagements(req.query);
            logger.info("getEngagements completed successfully");
            return ok(res, data);
        } catch (err) {
            return handleError(res, err, "getEngagements");
        }
    };

    return { getEngagementStats, getEngagements };
};

module.exports = createAdminEngagementsController;