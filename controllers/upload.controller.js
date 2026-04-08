const streamifier = require("streamifier");
const { cloudinary } = require("../config/cloudinary");
const MentorProfile = require("../models/MentorProfile");

// ── Helper: stream buffer to Cloudinary 
// We explicitly spread the options to ensure resource_type is handled correctly
const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { ...options }, // Ensure options like resource_type: "raw" are passed here
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
// ─────────────────────────────────────────────────────────────
const uploadProfilePicture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ message: "Only image files are allowed for profile pictures" });
    }

    const result = await uploadToCloudinary(req.file.buffer, {
      folder: "leapmentor/profiles",
      resource_type: "image", // Profile pics must stay as "image" for transformations
      use_filename: false,
      unique_filename: true,
      transformation: [
        { width: 400, height: 400, crop: "fill", gravity: "face" },
        { quality: "auto", fetch_format: "auto" },
      ],
    });

    return res.status(200).json({
      success: true,
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error("❌ uploadProfilePicture error:", err.message);
    return res.status(500).json({ message: "Failed to upload image." });
  }
};

// ─────────────────────────────────────────────────────────────
// POST /api/upload/verification-documents
// ─────────────────────────────────────────────────────────────
const uploadVerificationDocuments = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const resumeFile = req.files?.resume?.[0];
    const workExperienceFiles = req.files?.workExperienceDocs || [];

    if (!resumeFile) {
      return res.status(400).json({ message: "Resume is required" });
    }

    if (!phoneNumber || phoneNumber.trim() === "") {
      return res.status(400).json({ message: "Phone number is required" });
    }

    // ✅ Upload resume as "raw" to ensure PDFs load correctly
    const resumeResult = await uploadToCloudinary(resumeFile.buffer, {
      resource_type: "raw", // 👈 CRITICAL: Changed from "auto" to "raw" for PDFs
      folder: "leapmentor/verification-docs/resumes",
      use_filename: true,
      unique_filename: true,
    });

    const resumeDocument = {
      url: resumeResult.secure_url,
      publicId: resumeResult.public_id,
      uploadedAt: new Date(),
    };

    let workExperienceDocuments = [];

    if (workExperienceFiles.length > 0) {
      const workUploadPromises = workExperienceFiles.map((file) =>
        uploadToCloudinary(file.buffer, {
          resource_type: "raw", // 👈 CRITICAL: Changed to "raw"
          folder: "leapmentor/verification-docs/work-experience",
          use_filename: true,
          unique_filename: true,
        })
      );

      const workResults = await Promise.all(workUploadPromises);

      workExperienceDocuments = workResults.map((result) => ({
        url: result.secure_url,
        publicId: result.public_id,
        uploadedAt: new Date(),
      }));
    }

    const mentorProfile = await MentorProfile.findOneAndUpdate(
      { user: req.user._id },
      {
        phoneNumber: phoneNumber.trim(),
        resumeDocument,
        workExperienceDocuments,
      },
      { new: true }
    );

    if (!mentorProfile) {
      return res.status(404).json({ message: "Mentor profile not found" });
    }

    return res.status(200).json({
      success: true,
      resumeDocument,
      workExperienceDocuments,
    });
  } catch (err) {
    console.error("❌ uploadVerificationDocuments error:", err.message);
    return res.status(500).json({ message: "Failed to upload documents." });
  }
};

module.exports = { uploadProfilePicture, uploadVerificationDocuments };