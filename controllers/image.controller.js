// controllers/image.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

/**
 * @typedef {Object} ImageService
 * @property {(userId: string, query: Object) => { url: string, width: number, height: number }} getProfileImageUrl - Builds transformation asset links.
 */

/**
 * Factory assembling presentation layer controllers handling routing requests for asset transformations.
 * * @param {ImageService} imageService - Core media logic orchestration layer worker instance.
 * @param {{ logger: Logger }} dependencies - Application performance metric capture monitoring tool.
 * @returns {Object} Grouped controller endpoints route callback actions.
 */
const createImageController = (imageService, { logger }) => {

    /**
     * Express Route handler parsing route variables and scaling queries to return modified profile images.
     * * @function getProfileImage
     * @param {import('express').Request} req - Inbound network request framework context.
     * @param {import('express').Response} res - Standard connection output response transport pipe layer.
     */
    const getProfileImage = (req, res) => {
        try {
            const { userId } = req.params;
            const data = imageService.getProfileImageUrl(userId, req.query);
            logger.info("getProfileImage completed successfully");
            return ok(res, data);
        } catch (err) {
            return handleError(res, err, "image.getProfileImage");
        }
    };

    return { getProfileImage };
};

module.exports = createImageController;