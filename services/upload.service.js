// services/upload.service.js
const { sendDocumentsSubmittedEmail } = require("../utils/emails");
const { uploadToCloudinary } = require("../utils/cloudinaryUpload");
const { profilePictureId, resumeId, workExperienceId } = require("../utils/cloudinaryPublicId");

/**
 * @typedef {Object} CloudinaryAssetDocument
 * @property {string} url - Secure URL pointing to the hosted file location.
 * @property {string} publicId - The canonical asset public identity key assigned by Cloudinary.
 * @property {string} originalName - The original name of the uploaded local file string.
 * @property {Date} [uploadedAt] - Timestamp marking when the document upload was completed.
 */

/**
 * @typedef {Object} UploadRepository
 * @property {(userId: any, data: Object) => Promise<Object|null>} updateMentorProfileDocuments - Updates phone number and verification asset arrays.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} warn - Logs background mailing or subset attachment upload failures.
 */

/**
 * Factory function constructing the asset storage and document verification service layer.
 * * @param {UploadRepository} repo - Abstraction data registry layer instance.
 * @param {{ logger: Logger }} dependencies - Application core telemetry tracing tools.
 * @returns {Object} Configured service interface container exposing asset upload routines.
 */
const createUploadService = (repo, { logger }) => {
    /**
     * Uploads, applies crop boxes, and builds multi-tier eager thumbnail variants for user profile pictures.
     * * @async
     * @function uploadProfilePicture
     * @param {Object} inputContext - Parameters bucket tracking the incoming asset context.
     * @param {Object} inputContext.file - Multipart single file descriptor context.
     * @param {Buffer} inputContext.file.buffer - Raw file buffer stream map.
     * @param {string} inputContext.file.mimetype - Uploaded asset mime descriptor format.
     * @param {string} inputContext.file.originalname - Original client resource name.
     * @param {Object} inputContext.user - Request session actor model details.
     * @param {any} inputContext.user._id - Unique target owner reference key.
     * @returns {Promise<{ status: number, body: Object }>} Structural wrapper containing full size and avatar thumbnail URLs.
     */
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
                originalName: file.originalname,
            },
        };
    };

    /**
     * Handles credential onboarding verification assets by executing parallel authenticated uploads for resumes and experience items.
     * * @async
     * @function uploadVerificationDocuments
     * @param {Object} options - Combined files and configuration descriptors payload.
     * @param {string} options.phoneNumber - Target user contact number value.
     * @param {Object} options.resumeFile - Multipart file configuration holding resume binary data.
     * @param {Buffer} options.resumeFile.buffer - Raw resume data stream buffer.
     * @param {string} options.resumeFile.originalname - Core filename text.
     * @param {Object[]} options.workExperienceFiles - Array mapping supporting credentials data files.
     * @param {Object} options.user - Request session actor model details.
     * @param {string} options.user.name - Mentor name reference used for email alerts.
     * @param {string} options.user.email - Mentor electronic address identifier.
     * @param {any} options.user._id - Unique parent user locator index key.
     * @returns {Promise<{ status: number, body: Object }>} Object mapping verification outcome arrays rows.
     */
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