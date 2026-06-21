// controllers/user.controller.js
const { ok } = require("../utils/response");

const createUserController = ({ logger }) => {

    const getMe = (req, res) => {
        logger.info("getMe completed successfully");
        return ok(res, req.user);
    };

    return { getMe };
};

module.exports = createUserController;