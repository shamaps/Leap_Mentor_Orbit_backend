// controllers/refreshToken.controller.js
const { ok, fail } = require("../utils/response");
const { handleError } = require("../utils/appError");
const AppError = require("../utils/appError");

const createRefreshTokenController = (refreshTokenService, { logger }) => {

    const refresh = async (req, res) => {
        try {
            const raw = req.cookies?.refreshToken;
            const data = await refreshTokenService.refresh(raw, res);
            logger.info("refresh completed successfully");
            return ok(res, data);
        } catch (err) {
            return handleError(res, err, "auth.refresh");
        }
    };

    const logout = async (req, res) => {
        try {
            const raw = req.cookies?.refreshToken;
            const data = await refreshTokenService.logout(raw);
            res.clearCookie("refreshToken", { path: "/" });
            logger.info("logout completed successfully");
            return ok(res, data);
        } catch (err) {
            return handleError(res, err, "auth.logout");
        }
    };

    return { refresh, logout };
};

module.exports = createRefreshTokenController;