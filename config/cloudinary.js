// backend/config/cloudinary.js
const cloudinary = require("cloudinary").v2;
const { logger } = require("@sentry/node");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Verify config loaded correctly on startup
const verifyConnection = async () => {
  try {
    await cloudinary.api.ping();
    console.log("✅ Cloudinary connected successfully");
  } catch (err) {
    console.error("❌ Cloudinary connection failed:", err.message);
  }
};

module.exports = { cloudinary, verifyConnection };