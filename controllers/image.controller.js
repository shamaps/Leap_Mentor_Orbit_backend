// controllers/image.controller.js
const { ok } = require("../utils/response");
const { handleError } = require("../utils/appError");

const createImageController = (imageService, { logger }) => {

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