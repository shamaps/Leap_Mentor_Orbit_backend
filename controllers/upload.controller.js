const streamifier = require("streamifier");
const { cloudinary } = require("../config/cloudinary");
const MentorProfile = require("../models/MentorProfile");
const { sendDocumentsSubmittedEmail } = require("../utils/sendNotificationEmail");

const uploadToCloudinary = (buffer, options) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { ...options },
      (error, result) => {
        if (error) return reject(new Error(error.message ?? JSON.stringify(error)));
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
};

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
      resource_type: "image",
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

    const resumeResult = await uploadToCloudinary(resumeFile.buffer, {
      resource_type: "raw",
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
          resource_type: "raw",
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
        verificationStatus: "pending",
      },
      { new: true }
    );

    if (!mentorProfile) {
      return res.status(404).json({ message: "Mentor profile not found" });
    }

    // ── Send documents submitted email (non-blocking) ──
   sendDocumentsSubmittedEmail({
  mentorName:  req.user.name,
  mentorEmail: req.user.email,
}).catch((emailErr) => {
  console.error("❌ sendDocumentsSubmittedEmail failed:", emailErr.message);
});

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