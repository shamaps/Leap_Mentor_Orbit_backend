// services/mentorRefer.service.js
const AppError = require("../utils/appError");

/**
 * @typedef {Object} SimilarMentorMatch
 * @property {Object} user - Populated account details containing identification keys.
 * @property {string} user.name - Human name of the candidate mentor.
 * @property {string} user.email - Electronic mail address of the candidate mentor.
 * @property {string} currentRole - Active professional title or position.
 * @property {string} company - Recorded company or enterprise name.
 * @property {string[]} skills - Array collection grouping technical execution capability keywords.
 * @property {string} profilePicture - Dynamic asset link pointing to the avatar file.
 * @property {number} avgRating - Mathematical feedback score metric value.
 * @property {string} industry - Main domain classification descriptor.
 * @property {number} hourlyRate - Fixed token fee requirement per session hour.
 * @property {number} matchCount - Calculated overlapping count of lowercase matching competencies.
 */

/**
 * @typedef {Object} MentorReferRepository
 * @property {(id: string) => Promise<Object|null>} findRequestWithMentor - Resolves a dynamic request populated with its host mentor target.
 * @property {(userId: any) => Promise<{skills: string[], industry: string}|null>} findMyProfileSkills - Extracts competency and vertical category matrices.
 * @property {(userId: any, skills: string[]) => Promise<Object[]>} findSimilarMentors - Collects candidate alternative mentors up to a limit of 20.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Traces successful presentation operational pathways.
 * @property {(message: string, error: any) => void} error - Traces operational error logs.
 */

/**
 * Factory function constructing the core system Mentor Referral Service layer.
 * * @param {MentorReferRepository} mentorReferRepo - The database data access repository interface instance.
 * @param {{ logger: Logger }} dependencies - Application core monitoring and tracking dependencies parameters.
 * @returns {Object} Configured object map exposing peer mentor referral strategies.
 */
const createMentorReferService = (mentorReferRepo, { logger }) => {
    /**
     * Scans public directories to extract alternatives, scoring candidates based on structural skill matches.
     * Only accessible by the mentor who originally received the connection request.
     * * @async
     * @function getSimilarMentors
     * @param {string} requestId - Target incoming connection agreement locator primary key string.
     * @param {any} userId - Secure user identifier signature key checking ownership from session tokens.
     * @throws {AppError} 403 - If the caller identity index fails verification against record owner properties.
     * @throws {AppError} 404 - If database query lookups resolve completely empty rows records.
     * @returns {Promise<{ mentors: SimilarMentorMatch[], mySkills: string[] }>} Collection tracking scored target peers along with reference sets.
     */
    const getSimilarMentors = async (requestId, userId) => {
        const request = await mentorReferRepo.findRequestWithMentor(requestId);
        if (!request) {
            throw new AppError(404, "Request not found");
        }

        // Only the mentor who received it can fetch similar mentors
        if (request.mentor._id.toString() !== userId.toString()) {
            throw new AppError(403, "Not authorized");
        }

        const myProfile = await mentorReferRepo.findMyProfileSkills(userId);
        if (!myProfile || myProfile.skills.length === 0) {
            return { mentors: [], mySkills: [] };
        }

        const similarMentors = await mentorReferRepo.findSimilarMentors(userId, myProfile.skills);

        // Sort by number of matching skills (most relevant first)
        const mySkillsSet = new Set(myProfile.skills.map((s) => s.toLowerCase()));

        const scored = similarMentors.map((mentor) => {
            const matchCount = mentor.skills.filter((s) =>
                mySkillsSet.has(s.toLowerCase())
            ).length;
            return { ...mentor, matchCount };
        });

        scored.sort((a, b) => b.matchCount - a.matchCount);

        return { mentors: scored, mySkills: myProfile.skills };
    };

    return { getSimilarMentors };
};

module.exports = createMentorReferService;