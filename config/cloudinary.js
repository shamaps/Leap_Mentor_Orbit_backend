// backend/config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const logger = require("../utils/logger");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Verify config loaded correctly on startup
const verifyConnection = async () => {
  try {
    await cloudinary.api.ping();
    logger.info("Cloudinary connected successfully");
  } catch (err) {
    logger.error("Cloudinary connection failed", { error: err.message, stack: err.stack });  }
};

module.exports = { cloudinary, verifyConnection };