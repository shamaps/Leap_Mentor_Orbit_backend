// controllers/user.controller.js
const { ok } = require("../utils/response");

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Emits operational pathway success messages.
 * @property {(message: string, error: any) => void} error - Traces processing system errors.
 */

/**
 * Factory assembling presentation layer controller operations tied to profile queries.
 * * @param {{ logger: Logger }} dependencies - Core tracing and logging utilities frame.
 * @returns {Object} Collection container mapping account details route actions.
 */
const createUserController = ({ logger }) => {

    /**
     * Express middleware route handler rendering the active request actor's assigned user record profile data.
     * * @function getMe
     * @param {import('express').Request & { user: Object }} req - Inbound request framework parsed context capturing identity models.
     * @param {import('express').Response} res - Dispatched output data interface response channel transport connection.
     */
    const getMe = (req, res) => {
        logger.info("getMe completed successfully");
        return ok(res, req.user);
    };

    return { getMe };
};

module.exports = createUserController;