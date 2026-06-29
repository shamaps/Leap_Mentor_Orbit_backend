// controllers/refreshToken.controller.js
const { ok, fail } = require("../utils/response");
const { handleError } = require("../utils/appError");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} RefreshTokenService
 * @property {(rawCookieToken: string|undefined, res: import('express').Response) => Promise<Object>} refresh - Validates rotation tokens to dispatch updated authentication envelopes.
 * @property {(rawCookieToken: string|undefined) => Promise<{message: string}>} logout - Evicts active session tokens keys out of database tables.
 */

/**
 * Factory implementing presentation entry controllers layer handling HTTP cookie tokens orchestration.
 * * @param {RefreshTokenService} refreshTokenService - Underlying rotation logic core worker module instance.
 * @param {{ logger: Logger }} dependencies - Performance trace logger analytics diagnostics parameters wrapper.
 * @returns {Object} Grouped controller routes callback actions container mapping blueprint.
 */
const createRefreshTokenController = (refreshTokenService, { logger }) => {

    /**
     * Express Route Handler reading tracking cookies parameters to rotate authorization sets.
     * * @async
     * @function refresh
     * @param {import('express').Request} req - Inbound transaction request envelope parsing header cookie objects.
     * @param {import('express').Response} res - Outbound data interface component transport connector pipeline.
     */
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

    /**
     * Express Route Handler managing logout, purging persistent token entries, and scrubbing browser path cookies.
     * * @async
     * @function logout
     * @param {import('express').Request} req - Inbound network processing block request context envelope.
     * @param {import('express').Response} res - Terminal transport response connector closing communication lines.
     */
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