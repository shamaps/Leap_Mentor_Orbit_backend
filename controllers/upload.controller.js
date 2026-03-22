// backend/controllers/upload.controller.js
const streamifier    = require("streamifier");
const { cloudinary } = require("../config/cloudinary");

// ── Helper: stream buffer to Cloudinary ───────────────────────
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      options,
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

// ─────────────────────────────────────────────────────────────
// POST /api/upload/profile-picture
// Accepts: multipart/form-data with field "profilePicture"
// Returns: { url: "https://res.cloudinary.com/..." }
// ─────────────────────────────────────────────────────────────
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // ✅ Extra safety check — images only
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only image files are allowed for profile pictures" });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder:          "leapmentor/profiles",
      resource_type:   "image",
      use_filename:    false,
      unique_filename: true,
      // ✅ Auto optimize — compress + serve WebP where supported
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    return res.status(200).json({
      success: true,
      url:     result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error("❌ uploadProfilePicture error:", err.message);
    return res.status(500).json({ message: "Failed to upload image. Please try again." });
  }
};

module.exports = { uploadProfilePicture };