// services/mentorProfile.service.js
const { toMentorProfileDTO } = require("../utils/mappers/mentorProfile.mapper");
const AppError = require("../utils/appError");
const cache = require("../utils/cache");

/**
 * @typedef {Object} MentorProfileRepository
 * @property {(userId: any) => Promise<Object|null>} findProfileByUser - Looks up an unpopulated profile record by user ID.
 * @property {(userId: any) => Promise<Object|null>} findProfileByUserPopulated - Pulls profile records populated with primary account details.
 * @property {(data: Object) => Promise<Object>} createProfile - Persists a new mentor profile configuration document.
 * @property {(userId: any, body: Object) => Promise<Object|null>} updateProfileByUser - Finds and updates a mentor profile atomically.
 * @property {(userId: string) => Promise<Object|null>} findPublicProfileByUser - Resolves published profile fields matching target user parameters.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs standard functional completion parameters.
 * @property {(message: string, error: any) => void} error - Captures application execution errors.
 */

/**
 * Factory function constructing the system Mentor Profile Service layer.
 * * @param {MentorProfileRepository} mentorProfileRepo - Data layer persistence abstraction instance.
 * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Configured service interface container exposing profile handlers.
 */
const createMentorProfileService = (mentorProfileRepo, { logger }) => {
    /**
     * POST /api/mentor-profile
     * Validates, provisions, and caches a brand-new internal mentor profile document.
     * * @async
     * @function createProfile
     * @param {any} userId - Secure user identifier signature key checking ownership from request tokens.
     * @param {Object} body - Intake processing payload data package container.
     * @param {string} [body.currentRole] - Active business title context literal.
     * @param {string} [body.industry] - Primary industry vertical classification literal.
     * @param {string} [body.company] - Employment corporation name context literal.
     * @param {string} [body.bio] - Self-descriptive background professional biography summary context.
     * @param {string} [body.profilePicture] - Target avatar image hosting destination link.
     * @param {number} [body.yearsOfExperience] - Total years tracking variable value.
     * @param {number} [body.hourlyRate] - Base pricing token value assigned per session hour.
     * @param {string[]} [body.skills] - Collected tag labels specifying technical execution capabilities.
     * @param {string[]} [body.communicationPreferences] - Enforced channel matching array values.
     * @param {string[]} [body.languages] - List indicating spoken communication capabilities variables.
     * @param {string} [body.linkedInUrl] - Federated professional network link tracker.
     * @param {string} [body.portfolioUrl] - External engineering portfolio workspace url indicator.
     * @throws {AppError} 409 - If an internal record document for this user already exists.
     * @returns {Promise<{ message: string, profile: Object }>} Formatted confirmation payload along with mapped DTO layout details.
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
        await cache.invalidatePattern(`${cache.NS.MENTOR_LIST}:*`);
        return { message: "Mentor profile created successfully", profile: toMentorProfileDTO(profile) };
    };

    /**
     * GET /api/mentor-profile/me
     * Resolves the logged-in professional's complete populated mentor profile snapshot.
     * * @async
     * @function getMyProfile
     * @param {any} userId - Authenticated user credential validation identifier pointer.
     * @throws {AppError} 404 - If dynamic queries return uninitialized profile fields.
     * @returns {Promise<Object>} Sanitized mentor profile data transfer object.
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
     * Overwrites or updates specific properties in an existing profile document context, invalidating public caches.
     * * @async
     * @function updateProfile
     * @param {any} userId - Target modifier index parameter pointer key.
     * @param {Object} body - Delta fields criteria configuration container data.
     * @throws {AppError} 404 - If lookups resolve no matching structural records.
     * @returns {Promise<{ message: string, profile: Object }>} Success confirmation status payload.
     */
    const updateProfile = async (userId, body) => {
        const profile = await mentorProfileRepo.updateProfileByUser(userId, body);

        if (!profile) {
            throw new AppError(404, "Profile not found");
        }
        await cache.invalidatePattern(`${cache.NS.MENTOR_LIST}:*`);
        return { message: "Profile updated successfully", profile: toMentorProfileDTO(profile) };
    };

    /**
     * GET /api/mentor-profile/:id
     * Resolves public parameters mapping a mentor profile, purging matching list fragments.
     * * @async
     * @function getPublicProfile
     * @param {string} userId - Target dynamic path parameter index selector key string.
     * @throws {AppError} 404 - If database query resolves completely empty attributes.
     * @returns {Promise<Object>} Mapped public-facing DTO blueprint layout parameters.
     */
    const getPublicProfile = async (userId) => {
        const profile = await mentorProfileRepo.findPublicProfileByUser(userId);

        if (!profile) {
            throw new AppError(404, "Mentor profile not found");
        }
        await cache.invalidatePattern(`${cache.NS.MENTOR_LIST}:*`);
        return toMentorProfileDTO(profile);
    };

    return { createProfile, getMyProfile, updateProfile, getPublicProfile };
};

module.exports = createMentorProfileService;