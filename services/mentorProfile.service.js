// services/mentorProfile.service.js
const { toMentorProfileDTO } = require("../utils/mappers/mentorProfile.mapper");
const AppError = require("../utils/appError");
const createMentorProfileService = (mentorProfileRepo, { logger }) => {
/**
 * POST /api/mentor-profile
 */
const createProfile = async (userId, body) => {
    const existing = await mentorProfileRepo.findProfileByUser(userId);
    if (existing) {
        throw new AppError(409, "Profile already exists. Use update instead.");
    }

    const {
        currentRole,
        industry,
        company,
        bio,
        profilePicture,
        yearsOfExperience,
        hourlyRate,
        skills,
        communicationPreferences,
        languages,
        linkedInUrl,
        portfolioUrl,
    } = body;

    const profile = await mentorProfileRepo.createProfile({
        user: userId,
        currentRole,
        industry,
        company,
        bio,
        profilePicture: profilePicture || "",
        yearsOfExperience: yearsOfExperience || 0,
        hourlyRate: hourlyRate || 0,
        skills: skills || [],
        communicationPreferences: communicationPreferences || [],
        languages: languages || ["English"],
        linkedInUrl: linkedInUrl || "",
        portfolioUrl: portfolioUrl || "",
        isProfileComplete: true,
        isProfilePublished: true,
    });

    return { message: "Mentor profile created successfully", profile: toMentorProfileDTO(profile) };
};

/**
 * GET /api/mentor-profile/me
 */
const getMyProfile = async (userId) => {
    const profile = await mentorProfileRepo.findProfileByUserPopulated(userId);

    if (!profile) {
        throw new AppError(404, "Profile not found", { isProfileComplete: false });
    }

    return toMentorProfileDTO(profile);
};

/**
 * PUT /api/mentor-profile/me
 */
const updateProfile = async (userId, body) => {
    const profile = await mentorProfileRepo.updateProfileByUser(userId, body);

    if (!profile) {
        throw new AppError(404, "Profile not found");
    }

    return { message: "Profile updated successfully", profile: toMentorProfileDTO(profile) };
};

/**
 * GET /api/mentor-profile/:id
 */
const getPublicProfile = async (userId) => {
    const profile = await mentorProfileRepo.findPublicProfileByUser(userId);

    if (!profile) {
        throw new AppError(404, "Mentor profile not found");
    }

    return toMentorProfileDTO(profile);
};

    return { createProfile, getMyProfile, updateProfile, getPublicProfile };
};
module.exports = createMentorProfileService;