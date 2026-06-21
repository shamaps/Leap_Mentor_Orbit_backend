// services/image.service.js
const { cloudinary } = require("../config/cloudinary");

const DEFAULT_DIMENSION = 80;
const MIN_DIMENSION = 1;
const MAX_DIMENSION = 400;

const clampDimension = (value) =>
    Math.min(Math.max(Number.parseInt(value, 10) || DEFAULT_DIMENSION, MIN_DIMENSION), MAX_DIMENSION);

const createImageService = ({ logger }) => {

    /**
     * Builds a resized Cloudinary profile-image URL for a given user.
     * Cloudinary serves the pre-generated eager variant if available,
     * otherwise generates and caches it on the fly.
     *
     * @param {string} userId
     * @param {Object} query - raw req.query, expects optional w/h
     * @returns {{ url: string, width: number, height: number }}
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