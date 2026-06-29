// services/adminVerification.service.js
const { sendMentorVerifiedEmail } = require("../utils/emails");
const { toMentorProfileDTO } = require("../utils/mappers/mentorProfile.mapper");
const { signCloudinaryUrl } = require("../utils/cloudinarySign");
const AppError = require("../utils/appError");

/**
 * Factory function to create the Admin Verification Domain Service.
 * @param {Object} adminVerificationRepo - Repository responsible for accessing DB collections.
 * @param {Object} dependencies - System utility options.
 * @param {Object} dependencies.logger - Logger wrapper instance.
 * @returns {Object} Service endpoints dealing with mentor verification logic.
 */
const createAdminVerificationService = (adminVerificationRepo, { logger }) => {

    /**
     * Retrieves all requested mentor profiles, sanitized and paginated.
     * @param {Object} [params] - Configuration options.
     * @param {number|string} [params.page=1] - Active query page.
     * @param {number|string} [params.limit=20] - Size limit per page.
     * @param {string} [params.search] - Target profile query text.
     * @returns {Promise<Object>} Combined pagination metadata and payload list.
     */
    const getAllMentorVerifications = async ({ page = 1, limit = 20, search } = {}) => {
        const safePage = Math.max(1, Number.parseInt(page) || 1);
        const safeLimit = Math.min(50, Number.parseInt(limit) || 20);
        const skip = (safePage - 1) * safeLimit;

        const filter = {};
        if (search?.trim()) {
            const userIds = await adminVerificationRepo.findMentorUserIdsByName(search.trim());
            filter.user = { $in: userIds };
        }

        const [mentorProfiles, total] = await Promise.all([
            adminVerificationRepo.findAllMentorProfiles(filter, skip, safeLimit),
            adminVerificationRepo.countMentorProfiles(filter),
        ]);

        return {
            mentors: mentorProfiles,
            pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
        };
    };

    /**
     * Fetches details and temporary Cloudinary viewing signatures for sensitive documents.
     * @param {string} mentorProfileId - Target unique profile parameter string.
     * @returns {Promise<Object>} Extracted configuration elements with signed document strings.
     * @throws {AppError} 404 error if profile object cannot be found.
     */
    const getMentorVerificationById = async (mentorProfileId) => {
        const profile = await adminVerificationRepo.findMentorProfileById(mentorProfileId);

        if (!profile) {
            throw new AppError(404, "Mentor profile not found");
        }
        const mentorProfile = toMentorProfileDTO({ ...profile, user: undefined });

        if (profile.resumeDocument?.publicId) {
            profile.resumeDocument.url = signCloudinaryUrl(profile.resumeDocument.publicId, "raw");
        }
        if (profile.workExperienceDocuments?.length) {
            profile.workExperienceDocuments = profile.workExperienceDocuments.map((doc) => ({
                ...doc,
                url: signCloudinaryUrl(doc.publicId, "raw"),
            }));
        }
        return {
            user: profile.user,
            mentorProfile,
        };
    };

    /**
     * Approves verification status for a targeted profile and alerts via electronic message.
     * @param {string} mentorProfileId - Target unique profile sequence string.
     * @returns {Promise<Object>} Operation report map object.
     * @throws {AppError} 404 if profile not found, 400 if already verified.
     */
    const verifyMentor = async (mentorProfileId) => {
        const profile = await adminVerificationRepo.findMentorProfileDocumentById(mentorProfileId);

        if (!profile) {
            throw new AppError(404, "Mentor profile not found");
        }

        if (profile.verificationStatus === "verified") {
            throw new AppError(400, "Mentor is already verified");
        }

        profile.verificationStatus = "verified";
        await profile.save();

        // Non-blocking email
        sendMentorVerifiedEmail({
            mentorName: profile.user.name,
            mentorEmail: profile.user.email,
        }).catch((emailErr) => {
            logger.warn("sendMentorVerifiedEmail failed", { error: emailErr.message });
        });

        return {
            message: `${profile.user?.name || "Mentor"} has been verified successfully`,
            mentorProfileId: profile._id,
            verificationStatus: profile.verificationStatus,
        };
    };

    /**
     * Resets verified parameter status targets to standard unverified flags.
     * @param {string} mentorProfileId - Unique document database entry identity string.
     * @returns {Promise<Object>} Success text message details.
     * @throws {AppError} 404 if profile not found, 400 if already unverified.
     */
    const revokeMentorVerification = async (mentorProfileId) => {
        const profile = await adminVerificationRepo.findMentorProfileDocumentById(mentorProfileId);

        if (!profile) {
            throw new AppError(404, "Mentor profile not found");
        }

        if (profile.verificationStatus === "unverified") {
            throw new AppError(400, "Mentor is already unverified");
        }

        profile.verificationStatus = "unverified";
        await profile.save();

        return {
            message: `Verification revoked for ${profile.user?.name || "mentor"}`,
            mentorProfileId: profile._id,
            verificationStatus: profile.verificationStatus,
        };
    };

    return { getAllMentorVerifications, getMentorVerificationById, verifyMentor, revokeMentorVerification };
};

module.exports = createAdminVerificationService;