// services/adminVerification.service.js
const { sendMentorVerifiedEmail } = require("../utils/emails");
const { toMentorProfileDTO } = require("../utils/mappers/mentorProfile.mapper");
const { signCloudinaryUrl } = require("../utils/cloudinarySign");
const AppError = require("../utils/appError");
const createAdminVerificationService = (adminVerificationRepo, { logger }) => {

    const getAllMentorVerifications = async ({ page = 1, limit = 20 } = {}) => {
        const safePage = Math.max(1, parseInt(page) || 1);
        const safeLimit = Math.min(50, parseInt(limit) || 20);
        const skip = (safePage - 1) * safeLimit;

        const [mentorProfiles, total] = await Promise.all([
            adminVerificationRepo.findAllMentorProfiles(skip, safeLimit),
            adminVerificationRepo.countMentorProfiles(),
        ]);

        return {
            mentors: mentorProfiles,  
            pagination: { page: safePage, limit: safeLimit, total, pages: Math.ceil(total / safeLimit) },
        };
    };

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