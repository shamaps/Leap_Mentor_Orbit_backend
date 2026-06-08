const streamifier = require("streamifier");
const { cloudinary } = require("../config/cloudinary");
const { sendDocumentsSubmittedEmail } = require("../utils/sendNotificationEmail");
const repo = require("../repositories/upload.repository");

// ── Cloudinary helper ─────────────────────────────────────────
const uploadToCloudinary = (buffer, options) =>
    new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { ...options },
            (error, result) => {
                if (error) return reject(new Error(error.message ?? JSON.stringify(error)));
                resolve(result);
            }
        );
        streamifier.createReadStream(buffer).pipe(uploadStream);
    });

// ─────────────────────────────────────────────────────────────

const uploadProfilePicture = async ({ file }) => {
    if (!file) {
        return { status: 400, body: { message: "No file uploaded" } };
    }

    if (!file.mimetype.startsWith("image/")) {
        return { status: 400, body: { message: "Only image files are allowed for profile pictures" } };
    }

    const result = await uploadToCloudinary(file.buffer, {
        folder: "leapmentor/profiles",
        resource_type: "image",
        use_filename: false,
        unique_filename: true,
        transformation: [
            { width: 400, height: 400, crop: "fill", gravity: "face" },
            { quality: "auto", fetch_format: "auto" },
        ],
    });

    return {
        status: 200,
        body: { success: true, url: result.secure_url, publicId: result.public_id },
    };
};

const uploadVerificationDocuments = async ({ phoneNumber, resumeFile, workExperienceFiles, user }) => {
    if (!resumeFile) {
        return { status: 400, body: { message: "Resume is required" } };
    }

    if (!phoneNumber || phoneNumber.trim() === "") {
        return { status: 400, body: { message: "Phone number is required" } };
    }

    // ── Upload resume ──
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

    // ── Upload work experience docs ──
    let workExperienceDocuments = [];

    if (workExperienceFiles.length > 0) {
        const workResults = await Promise.all(
            workExperienceFiles.map((file) =>
                uploadToCloudinary(file.buffer, {
                    resource_type: "raw",
                    folder: "leapmentor/verification-docs/work-experience",
                    use_filename: true,
                    unique_filename: true,
                })
            )
        );

        workExperienceDocuments = workResults.map((result) => ({
            url: result.secure_url,
            publicId: result.public_id,
            uploadedAt: new Date(),
        }));
    }

    // ── Persist to DB ──
    const mentorProfile = await repo.updateMentorProfileDocuments(user._id, {
        phoneNumber: phoneNumber.trim(),
        resumeDocument,
        workExperienceDocuments,
        verificationStatus: "pending",
    });

    if (!mentorProfile) {
        return { status: 404, body: { message: "Mentor profile not found" } };
    }

    // ── Send documents submitted email (non-blocking) ──
    sendDocumentsSubmittedEmail({ mentorName: user.name, mentorEmail: user.email }).catch((emailErr) => {
        console.error(":x: sendDocumentsSubmittedEmail failed:", emailErr.message);
    });

    return {
        status: 200,
        body: { success: true, resumeDocument, workExperienceDocuments },
    };
};

module.exports = { uploadProfilePicture, uploadVerificationDocuments };