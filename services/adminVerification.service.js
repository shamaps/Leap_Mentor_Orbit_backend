// services/adminVerification.service.js
const { sendMentorVerifiedEmail } = require("../utils/emails");
const { toMentorProfileDTO } = require("../utils/mappers/mentorProfile.mapper");
const { signCloudinaryUrl } = require("../utils/cloudinarySign");

const createAdminVerificationService = (adminVerificationRepo, { logger }) => {

const getAllMentorVerifications = async () => {
    const mentorProfiles = await adminVerificationRepo.findAllMentorProfiles();

    const mentors = mentorProfiles.map((profile) => ({
        user: profile.user,
        mentorProfile: toMentorProfileDTO({ ...profile, user: undefined }),
    }));

    return { mentors, total: mentors.length };
};

const getMentorVerificationById = async (mentorProfileId) => {
    const profile = await adminVerificationRepo.findMentorProfileById(mentorProfileId);

    if (!profile) {
        const err = new Error("Mentor profile not found");
        err.statusCode = 404;
        throw err;
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
        const err = new Error("Mentor profile not found");
        err.statusCode = 404;
        throw err;
    }

    if (profile.verificationStatus === "verified") {
        const err = new Error("Mentor is already verified");
        err.statusCode = 400;
        throw err;
    }

    profile.verificationStatus = "verified";
    await profile.save();

    // Non-blocking email
    sendMentorVerifiedEmail({
        mentorName: profile.user.name,
        mentorEmail: profile.user.email,
    }).catch((emailErr) => {
        logger.error("❌ sendMentorVerifiedEmail failed:", emailErr.message);
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
        const err = new Error("Mentor profile not found");
        err.statusCode = 404;
        throw err;
    }

    if (profile.verificationStatus === "unverified") {
        const err = new Error("Mentor is already unverified");
        err.statusCode = 400;
        throw err;
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