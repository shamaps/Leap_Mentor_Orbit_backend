// backend/config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const logger = require("../utils/logger");
const config = require("./env");
cloudinary.config({
  cloud_name: config.cloudinaryCloudName,
  api_key: config.cloudinaryApiKey,
  api_secret: config.cloudinaryApiSecret,
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