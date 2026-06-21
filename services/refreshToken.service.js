// services/refreshToken.service.js
const crypto = require("node:crypto");
const AppError = require("../utils/appError");
const { signToken, setRefreshCookie, getRefreshMs, generateRefreshToken } = require("../utils/auth.utils");
const { toUserDTO } = require("../utils/mappers/user.mapper");

const createRefreshTokenService = (repo, { logger }) => {

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