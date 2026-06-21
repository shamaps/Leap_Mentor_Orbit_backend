
const { sendDocumentsSubmittedEmail } = require("../utils/emails");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { profilePictureId, resumeId, workExperienceId } = require("../utils/cloudinaryPublicId");
const createUploadService = (repo, { logger }) => {
    const uploadProfilePicture = async ({ file, user }) => {
    if (!file) {
        return { status: 400, body: { message: "No file uploaded" } };
    }

    if (!file.mimetype.startsWith("image/")) {
        return { status: 400, body: { message: "Only image files are allowed for profile pictures" } };
    }

        const result = await uploadToCloudinary(file.buffer, {
            resource_type: "image",
            public_id: profilePictureId(user._id),
            overwrite: true,
            transformation: [
                { width: 400, height: 400, crop: "fill", gravity: "face" },
                { quality: "auto", fetch_format: "auto" },
            ],
            eager: [
                // Avatar — used in chat, sidebar, cards
                { width: 56, height: 56, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" },
                // Card — used in MentorCard, ConnectCard
                { width: 80, height: 80, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" },
                // Profile modal — used in MentorProfileModal, ProfileHeroCard
                { width: 160, height: 160, crop: "fill", gravity: "face", quality: "auto", fetch_format: "auto" },
            ],
            eager_async: false,
        });

        return {
            status: 200,
            body: {
                success: true,
                url: result.secure_url,                           // 400×400 full size
                thumbnail56: result.eager?.[0]?.secure_url,      // 56×56  avatar
                thumbnail80: result.eager?.[1]?.secure_url,      // 80×80  card
                thumbnail160: result.eager?.[2]?.secure_url,      // 160×160 modal
                publicId: result.public_id,
            },
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
    // AFTER
    const resumeResult = await uploadToCloudinary(resumeFile.buffer, {
        resource_type: "raw",
        public_id: resumeId(user._id, resumeFile.originalname),
        type: "authenticated",
        overwrite: false,
    });

    const resumeDocument = {
        url: resumeResult.secure_url,
        publicId: resumeResult.public_id,
        originalName: resumeFile.originalname,
        uploadedAt: new Date(), 
    };

    // ── Upload work experience docs ──
    let workExperienceDocuments = [];

    if (workExperienceFiles.length > 0) {
        const workResults = await Promise.allSettled(
            workExperienceFiles.map((file) => uploadToCloudinary(file.buffer, { 
                    resource_type: "raw",
                    public_id: workExperienceId(user._id, file.originalname),
                    type: "authenticated",
                    overwrite: false,
                })
            )
        );

        const failed = workResults.filter(r => r.status === "rejected");
        if (failed.length) {
            logger.warn("Some work experience docs failed to upload", {
                failedCount: failed.length,
                errors: failed.map(f => f.reason?.message),
            });
        }
        workExperienceDocuments = workResults
            .filter(r => r.status === "fulfilled")
            .map(({ value }, i) => ({
                url: value.secure_url,
                publicId: value.public_id,
                originalName: workExperienceFiles[i].originalname,
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
        logger.warn("sendDocumentsSubmittedEmail failed", { error: emailErr.message });
    });
    return {
        status: 200,
        body: { success: true, resumeDocument, workExperienceDocuments },
    };
};

    return { uploadProfilePicture, uploadVerificationDocuments };
};
module.exports = createUploadService;