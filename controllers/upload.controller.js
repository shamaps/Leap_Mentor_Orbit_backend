// backend/controllers/upload.controller.js
const streamifier    = require("streamifier");
const { cloudinary } = require("../config/cloudinary");
const MentorProfile  = require("../models/MentorProfile");

// ── Helper: stream buffer to Cloudinary 
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
// ─────────────────────────────────────────────────────────────
// POST /api/upload/verification-documents
// Accepts: multipart/form-data with fields:
//   - "resume"              → single file (PDF/image)
//   - "workExperienceDocs"  → up to 3 files (PDF/image)
//   - "phoneNumber"         → string in req.body
// Returns: { success: true, resumeDocument, workExperienceDocuments }
// ─────────────────────────────────────────────────────────────
const uploadVerificationDocuments = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const resumeFile = req.files?.resume?.[0];
    const workExperienceFiles = req.files?.workExperienceDocs || [];

    // ✅ Validate — at least resume and phone number required
    if (!resumeFile) {
      return res.status(400).json({ message: "Resume is required" });
    }

    if (!phoneNumber || phoneNumber.trim() === "") {
      return res.status(400).json({ message: "Phone number is required" });
    }

    if (workExperienceFiles.length > 3) {
      return res.status(400).json({ message: "Maximum 3 work experience documents allowed" });
    }

    // ✅ Upload resume to Cloudinary
    const resumeResult = await uploadToCloudinary(resumeFile.buffer, {
      folder:          "leapmentor/verification-docs/resumes",
      resource_type:   "auto",
      use_filename:    false,
      unique_filename: true,
    });

    const resumeDocument = {
      url:        resumeResult.secure_url,
      publicId:   resumeResult.public_id,
      uploadedAt: new Date(),
    };

    // ✅ Upload work experience docs in parallel (if any)
    let workExperienceDocuments = [];

    if (workExperienceFiles.length > 0) {
      const workUploadPromises = workExperienceFiles.map((file) =>
        uploadToCloudinary(file.buffer, {
          folder:          "leapmentor/verification-docs/work-experience",
          resource_type:   "auto",
          use_filename:    false,
          unique_filename: true,
        })
      );

      const workResults = await Promise.all(workUploadPromises);

      workExperienceDocuments = workResults.map((result) => ({
        url:        result.secure_url,
        publicId:   result.public_id,
        uploadedAt: new Date(),
      }));
    }

    // ✅ Save everything to MentorProfile
    const mentorProfile = await MentorProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        phoneNumber:            phoneNumber.trim(),
        resumeDocument,
        workExperienceDocuments,
      },
      { new: true }
    );

    if (!mentorProfile) {
      return res.status(404).json({ message: "Mentor profile not found" });
    }

    return res.status(200).json({
      success:                true,
      resumeDocument,
      workExperienceDocuments,
    });
  } catch (err) {
    console.error("❌ uploadVerificationDocuments error:", err.message);
    return res.status(500).json({ message: "Failed to upload documents. Please try again." });
  }
};

module.exports = { uploadProfilePicture,uploadVerificationDocuments };