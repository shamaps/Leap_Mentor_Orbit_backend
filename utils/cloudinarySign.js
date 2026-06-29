// utils/cloudinarySign.js
const { cloudinary } = require("../config/cloudinary");

/**
 * Generates a signed Cloudinary URL valid for 15 minutes.
 * Use this whenever serving authenticated-type files to users.
 *
 * @param {string} publicId - the Cloudinary public_id stored in DB
 * @param {string} resourceType - "raw" | "image" | "video"
 * @returns {string} signed URL
 */
const signCloudinaryUrl = (publicId, resourceType = "raw") => {
    return cloudinary.url(publicId, {
        resource_type: resourceType,
        type: "authenticated",
        sign_url: true,
        expires_at: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
    });
};

module.exports = { signCloudinaryUrl };