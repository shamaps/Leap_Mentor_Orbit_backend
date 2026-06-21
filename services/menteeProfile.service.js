// services/menteeProfile.service.js
const { toMenteeProfileDTO } = require("../utils/mappers/menteeProfile.mapper");
const AppError = require("../utils/appError");
const createMenteeProfileService = (menteeProfileRepo, { logger }) => {
/**
 * POST /api/mentee-profile
 */
const createProfile = async (userId, body) => {
    const existing = await menteeProfileRepo.findProfileByUser(userId);
    if (existing) {
        throw new AppError(409, "Profile already exists");
    }

    const {
        currentRole,
        industry,
        company,
        yearsOfExperience,
        bio,
        profilePicture,
        linkedInUrl,
        portfolioUrl,
        skills,
        interestedFields,
        communicationPreferences,
        languages,
    } = body;

    const profile = await menteeProfileRepo.createProfile({
        user: userId,
        currentRole,
        industry,
        company,
        yearsOfExperience: yearsOfExperience || 0,
        bio,
        profilePicture: profilePicture || "",
        linkedInUrl: linkedInUrl || "",
        portfolioUrl: portfolioUrl || "",
        skills: skills || [],
        interestedFields: interestedFields || [],
        communicationPreferences: communicationPreferences || [],
        languages: languages || ["English"],
        isProfileComplete: true,
        isProfilePublished: true,
    });

    return { message: "Mentee profile created successfully", profile: toMenteeProfileDTO(profile) };
};

/**
 * GET /api/mentee-profile/me
 */
const getMyProfile = async (userId) => {
    const profile = await menteeProfileRepo.findProfileByUserPopulated(userId);

    if (!profile) {
        throw new AppError(404, "Profile not found", { isProfileComplete: false });
    }

    return toMenteeProfileDTO(profile);
};

/**
 * PUT /api/mentee-profile/me
 */
const updateProfile = async (userId, body) => {
    const profile = await menteeProfileRepo.updateProfileByUser(userId, body);

    if (!profile) {
        throw new AppError(404, "Profile not found");
    }
    return { message: "Profile updated successfully", profile: toMenteeProfileDTO(profile) };
};

/**
 * GET /api/mentee-profile/:id
 */
const getPublicProfile = async (userId) => {
    const profile = await menteeProfileRepo.findPublicProfileByUser(userId);

    if (!profile) {
        throw new AppError(404, "Mentee profile not found");
    }

    return toMenteeProfileDTO(profile);
};

    return { createProfile, getMyProfile, updateProfile, getPublicProfile };
};
module.exports = createMenteeProfileService;