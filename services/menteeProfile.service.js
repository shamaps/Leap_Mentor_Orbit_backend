// services/menteeProfile.service.js
const { toMenteeProfileDTO } = require("../utils/mappers/menteeProfile.mapper");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} MenteeProfileRepository
 * @property {(userId: any) => Promise<Object|null>} findProfileByUser - Looks up an unpopulated profile by user ID.
 * @property {(userId: any) => Promise<Object|null>} findProfileByUserPopulated - Pulls profile records populated with account details.
 * @property {(data: Object) => Promise<Object>} createProfile - Persists a new mentee profile document.
 * @property {(userId: any, body: Object) => Promise<Object|null>} updateProfileByUser - Finds and updates a mentee profile atomically.
 * @property {(userId: string) => Promise<Object|null>} findPublicProfileByUser - Resolves published profile attributes matching target user parameter criteria.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function constructing the core system Mentee Profile Service layer.
 * * @param {MenteeProfileRepository} menteeProfileRepo - Data layer persistence abstraction instance.
 * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Configured object map exposing profile handling methodologies.
 */
const createMenteeProfileService = (menteeProfileRepo, { logger }) => {
    /**
     * POST /api/mentee-profile
     * Validates and provisions a brand-new internal mentee profile document with fallbacks.
     * * @async
     * @function createProfile
     * @param {any} userId - Secure user identifier signature key checking ownership from request states.
     * @param {Object} body - Intake processing payload data package context container.
     * @param {string} [body.currentRole] - Active business title context literal.
     * @param {string} [body.industry] - Primary industry context group literal.
     * @param {string} [body.company] - Employment corporation name context literal.
     * @param {number|string} [body.yearsOfExperience] - Total years tracking variable value.
     * @param {string} [body.bio] - Short self-descriptive biography summary context.
     * @param {string} [body.profilePicture] - Target avatar image hosting destination link.
     * @param {string} [body.linkedInUrl] - Federated professional network link tracker.
     * @param {string} [body.portfolioUrl] - External engineering portfolio workspace url indicator.
     * @param {string[]} [body.skills] - Collected tag labels specifying technical execution capabilities.
     * @param {string[]} [body.interestedFields] - Collection tracking targets for growth paths.
     * @param {string[]} [body.communicationPreferences] - Enforced channel matching array values.
     * @param {string[]} [body.languages] - List indicating spoken communication capabilities variables.
     * @throws {AppError} 409 - If an internal record document for this user already exists.
     * @returns {Promise<{ message: string, profile: Object }>} Formatted confirmation payload along with mapped DTO layout details.
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
     * Resolves the logged-in user's complete populated mentee profile snapshot.
     * * @async
     * @function getMyProfile
     * @param {any} userId - Authenticated user credential validation identifier pointer.
     * @throws {AppError} 404 - If dynamic queries return uninitialized profile fields.
     * @returns {Promise<Object>} Sanitized mentee profile data transfer object.
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
     * Overwrites or updates selective properties in an existing profile document context.
     * * @async
     * @function updateProfile
     * @param {any} userId - Target modifier index parameter pointer key.
     * @param {Object} body - Delta fields criteria configuration container data.
     * @throws {AppError} 404 - If lookups resolve no matching structural records.
     * @returns {Promise<{ message: string, profile: Object }>} Success confirmation status payload.
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
     * Resolves localized public variables mapping a mentee profile.
     * * @async
     * @function getPublicProfile
     * @param {string} userId - Target dynamic path parameter index selector key string.
     * @throws {AppError} 404 - If database query resolves completely empty attributes.
     * @returns {Promise<Object>} Mapped public-facing DTO blueprint layout parameters.
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