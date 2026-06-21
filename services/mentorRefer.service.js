// services/mentorRefer.service.js
const AppError = require("../utils/appError");
const createMentorReferService = (mentorReferRepo, { logger }) => {
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