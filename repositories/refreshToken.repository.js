// repositories/refreshToken.repository.js
const RefreshToken = require("../models/RefreshToken");
const logger = require("../utils/logger");

const findByHash = async (tokenHash) => {
    try {
        return await RefreshToken.findOne({ tokenHash })
    .populate("user", "_id email roles isEmailVerified isDeleted");

    } catch (err) {
        logger.error("DB error in findByHash", { error: err.message });
        throw err;
    }
};

const deleteById = async (id) => {
    try {
        return await RefreshToken.deleteOne({ _id: id });
    } catch (err) {
        logger.error("DB error in deleteById", { error: err.message });
        throw err;
    }
};

const deleteByHash = async (tokenHash) => {
    try {
        return await RefreshToken.deleteOne({ tokenHash });
    } catch (err) {
        logger.error("DB error in deleteByHash", { error: err.message });
        throw err;
    }
};

const create = async ({ userId, tokenHash, expiresAt }) => {
    try {
        return await RefreshToken.create({ user: userId, tokenHash, expiresAt });
    } catch (err) {
        logger.error("DB error in create (refreshToken)", { error: err.message });
        throw err;
    }
};

module.exports = { findByHash, deleteById, deleteByHash, create };