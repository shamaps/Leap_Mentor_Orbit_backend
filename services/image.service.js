// services/image.service.js
const { cloudinary } = require("../config/cloudinary");

const DEFAULT_DIMENSION = 80;
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 400;

/**
 * Validates and restrains dimensional bounding properties within system minimum and maximum limits.
 * * @private
 * @function clampDimension
 * @param {any} value - The input integer or string value to be evaluated.
 * @returns {number} A validated, clamped dimensional number between 1 and 400.
 */
const clampDimension = (value) =>
    Math.min(Math.max(Number.parseInt(value, 10) || DEFAULT_DIMENSION, MIN_DIMENSION), MAX_DIMENSION);

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function constructing the Image Service layer.
 * * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Configured service interface container for asset mutations.
 */
const createImageService = ({ logger }) => {

    /**
     * Builds a resized Cloudinary profile-image URL for a given user.
     * Cloudinary serves the pre-generated eager variant if available,
     * otherwise generates and caches it on the fly.
     * * @function getProfileImageUrl
     * @param {string} userId - Target primary account identifier string.
     * @param {Object} [query={}] - Raw request query parameters payload context.
     * @param {number|string} [query.w] - Requested width boundary dimension in pixels.
     * @param {number|string} [query.h] - Requested height boundary dimension in pixels.
     * @returns {{ url: string, width: number, height: number }} Object containing the transformed URL and dimensions.
     */
    const getProfileImageUrl = (userId, query = {}) => {
        const w = clampDimension(query.w);
        const h = clampDimension(query.h);

        const publicId = `leapmentor/profiles/user-${userId}`;

        const url = cloudinary.url(publicId, {
            resource_type: "image",
            type: "upload",
            transformation: [
                { width: w, height: h, crop: "fill", gravity: "face" },
                { quality: "auto", fetch_format: "auto" },
            ],
        });

        return { url, width: w, height: h };
    };

    return { getProfileImageUrl };
};

module.exports = createImageService;