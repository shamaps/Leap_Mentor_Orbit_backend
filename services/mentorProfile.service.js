// services/mentorProfile.service.js
const mentorProfileRepo = require("../repositories/mentorProfile.repository");

const { logger } = require("@sentry/node");
/**
 * POST /api/mentor-profile
 */
const createProfile = async (userId, body) => {
    const existing = await mentorProfileRepo.findProfileByUser(userId);
    if (existing) {
        const err = new Error("Profile already exists. Use update instead.");
        err.statusCode = 409;
        throw err;
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

    return { message: "Mentor profile created successfully", profile };
};

/**
 * GET /api/mentor-profile/me
 */
const getMyProfile = async (userId) => {
    const profile = await mentorProfileRepo.findProfileByUserPopulated(userId);

    if (!profile) {
        const err = new Error("Profile not found");
        err.statusCode = 404;
        err.isProfileComplete = false;
        throw err;
    }

    return profile;
};

/**
 * PUT /api/mentor-profile/me
 */
const updateProfile = async (userId, body) => {
    const profile = await mentorProfileRepo.updateProfileByUser(userId, body);

    if (!profile) {
        const err = new Error("Profile not found");
        err.statusCode = 404;
        throw err;
    }

    return { message: "Profile updated successfully", profile };
};

/**
 * GET /api/mentor-profile/:id
 */
const getPublicProfile = async (userId) => {
    const profile = await mentorProfileRepo.findPublicProfileByUser(userId);

    if (!profile) {
        const err = new Error("Mentor profile not found");
        err.statusCode = 404;
        throw err;
    }

    return profile;
};

module.exports = {
    createProfile,
    getMyProfile,
    updateProfile,
    getPublicProfile,
};