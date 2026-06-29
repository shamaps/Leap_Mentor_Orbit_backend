// services/refreshToken.service.js
const crypto = require("node:crypto");
const AppError = require("../utils/appError");
const { signToken, setRefreshCookie, getRefreshMs, generateRefreshToken } = require("../utils/auth.utils");
const { toUserDTO } = require("../utils/mappers/user.mapper");

/**
 * @typedef {Object} StoredRefreshToken
 * @property {any} _id - Unique primary database identifier key for the token document.
 * @property {string} tokenHash - SHA-256 hex digest of the raw refresh token.
 * @property {Date} expiresAt - Timestamp marking token expiration constraints.
 * @property {Object} user - Populated parent user document context.
 * @property {any} user._id - Unique identifier tracking the user account.
 */

/**
 * @typedef {Object} RefreshTokenRepository
 * @property {(tokenHash: string) => Promise<StoredRefreshToken|null>} findByHash - Locates a token record by its hashed state, populating user details.
 * @property {(id: any) => Promise<Object>} deleteById - Clears a single token record by its primary key.
 * @property {(tokenHash: string) => Promise<Object>} deleteByHash - Clears a token record by its hash signature.
 * @property {(data: {userId: any, tokenHash: string, expiresAt: Date}) => Promise<Object>} create - Registers a fresh token rotation row.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs routine service method milestones.
 * @property {(message: string, meta?: Object) => void} error - Traces processing failure blocks.
 */

/**
 * Factory function constructing the token rotation and lifecycle management service layer.
 * * @param {RefreshTokenRepository} repo - Abstraction data registry layer instance.
 * @param {{ logger: Logger }} dependencies - Application core telemetry tracing tools.
 * @returns {Object} Configured service interface containing token rotation and logout methods.
 */
const createRefreshTokenService = (repo, { logger }) => {

    /**
     * Re-authenticates a session via token rotation, invalidating the old hash and dispatching fresh cookie payloads.
     * * @async
     * @function refresh
     * @param {string|undefined} rawCookieToken - Unverified raw plaintext token extracted from request cookies.
     * @param {import('express').Response} res - Standard outbound data transport pipeline response channel.
     * @throws {AppError} 401 - If token arguments are absent, expired, or mismatch stored signatures.
     * @returns {Promise<{ accessToken: string, user: Object }>} Fresh access token wrapper along with sanitized user DTO.
     */
    const refresh = async (rawCookieToken, res) => {
        if (!rawCookieToken) throw new AppError(401, "No refresh token");

        const hashed = crypto.createHash("sha256").update(rawCookieToken).digest("hex");
        const stored = await repo.findByHash(hashed);

        if (!stored || stored.expiresAt < new Date()) {
            throw new AppError(401, "Refresh token expired or invalid");
        }

        // Rotation: delete old token, issue new pair
        await repo.deleteById(stored._id);

        const newRefreshRaw = generateRefreshToken();
        const newRefreshHash = crypto.createHash("sha256").update(newRefreshRaw).digest("hex");

        await repo.create({
            userId: stored.user._id,
            tokenHash: newRefreshHash,
            expiresAt: new Date(Date.now() + getRefreshMs()),
        });

        const accessToken = signToken(stored.user._id);
        setRefreshCookie(res, newRefreshRaw);

        return { accessToken, user: toUserDTO(stored.user) };
    };

    /**
     * Evicts active token lifecycles from persistent storage based on raw cookie inputs.
     * * @async
     * @function logout
     * @param {string|undefined} rawCookieToken - Plaintxt token identifier to invalidate.
     * @returns {Promise<{ message: string }>} Success response status confirmation text.
     */
    const logout = async (rawCookieToken) => {
        if (rawCookieToken) {
            const hashed = crypto.createHash("sha256").update(rawCookieToken).digest("hex");
            await repo.deleteByHash(hashed);
        }
        return { message: "Logged out successfully" };
    };

    return { refresh, logout };
};

module.exports = createRefreshTokenService;