// repositories/refreshToken.repository.js
const RefreshToken = require("../models/RefreshToken");
const logger = require("../utils/logger");

/**
 * Searches data grids for matching hash signatures, populating granular user session security fields.
 * * @async
 * @function findByHash
 * @param {string} tokenHash - SHA-256 computed hash identifier criteria string.
 * @throws {Error} Relays internal connection exception faults following trace logging.
 * @returns {Promise<StoredRefreshToken|null>} Hydrated document pointer context layout mapping attributes or null.
 */
const findByHash = async (tokenHash) => {
    try {
        return await RefreshToken.findOne({ tokenHash })
            .populate("user", "_id email roles isEmailVerified isDeleted");

    } catch (err) {
        logger.error("DB error in findByHash", { error: err.message });
        throw err;
    }
};

/**
 * Deletes a targeted token entry completely by primary database key indicator.
 * * @async
 * @function deleteById
 * @param {any} id - Target token primary object indicator tracking records.
 * @throws {Error} Relays database connectivity failure blocks.
 * @returns {Promise<Object>} MongoDB deletion summary report tracking counts.
 */
const deleteById = async (id) => {
    try {
        return await RefreshToken.deleteOne({ _id: id });
    } catch (err) {
        logger.error("DB error in deleteById", { error: err.message });
        throw err;
    }
};

/**
 * Deletes a token entry completely matching selected cryptographic hashes.
 * * @async
 * @function deleteByHash
 * @param {string} tokenHash - SHA-256 digest string criteria.
 * @throws {Error} Relays internal processing exceptions.
 * @returns {Promise<Object>} MongoDB action results verification parameters.
 */
const deleteByHash = async (tokenHash) => {
    try {
        return await RefreshToken.deleteOne({ tokenHash });
    } catch (err) {
        logger.error("DB error in deleteByHash", { error: err.message });
        throw err;
    }
};

/**
 * Registers a new session tracking token document row onto persistence registries.
 * * @async
 * @function create
 * @param {Object} data - Schema constraints verified criteria configuration container.
 * @param {any} data.userId - Associated parent account owner tracking index locator.
 * @param {string} data.tokenHash - Processed secure hash sequence signature string.
 * @param {Date} data.expiresAt - Bounding chronological expiration limit identifier.
 * @throws {Error} Relays operational storage write errors.
 * @returns {Promise<Object>} Freshly written Mongoose database record model instance.
 */
const create = async ({ userId, tokenHash, expiresAt }) => {
    try {
        return await RefreshToken.create({ user: userId, tokenHash, expiresAt });
    } catch (err) {
        logger.error("DB error in create (refreshToken)", { error: err.message });
        throw err;
    }
};

module.exports = { findByHash, deleteById, deleteByHash, create };