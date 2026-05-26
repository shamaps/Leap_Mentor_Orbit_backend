// services/menteeProfile.service.js
const menteeProfileRepo = require("../repositories/menteeProfile.repository");

/**
 * POST /api/mentee-profile
 */
const createProfile = async (userId, body) => {
    const existing = await menteeProfileRepo.findProfileByUser(userId);
    if (existing) {
        const err = new Error("Profile already exists. Use update instead.");
        err.statusCode = 409;
        throw err;
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

    return { message: "Mentee profile created successfully", profile };
};

/**
 * GET /api/mentee-profile/me
 */
const getMyProfile = async (userId) => {
    const profile = await menteeProfileRepo.findProfileByUserPopulated(userId);

    if (!profile) {
        const err = new Error("Profile not found");
        err.statusCode = 404;
        err.isProfileComplete = false;
        throw err;
    }

    return profile;
};

/**
 * PUT /api/mentee-profile/me
 */
const updateProfile = async (userId, body) => {
    const profile = await menteeProfileRepo.updateProfileByUser(userId, body);

    if (!profile) {
        const err = new Error("Profile not found");
        err.statusCode = 404;
        throw err;
    }

    return { message: "Profile updated successfully", profile };
};

/**
 * GET /api/mentee-profile/:id
 */
const getPublicProfile = async (userId) => {
    const profile = await menteeProfileRepo.findPublicProfileByUser(userId);

    if (!profile) {
        const err = new Error("Mentee profile not found");
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