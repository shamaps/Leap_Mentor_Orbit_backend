// services/mentorRefer.service.js
const mentorReferRepo = require("../repositories/mentorRefer.repository");

const getSimilarMentors = async (requestId, userId) => {
    const request = await mentorReferRepo.findRequestWithMentor(requestId);
    if (!request) {
        const err = new Error("Request not found");
        err.statusCode = 404;
        throw err;
    }

    // Only the mentor who received it can fetch similar mentors
    if (request.mentor._id.toString() !== userId.toString()) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
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

module.exports = { getSimilarMentors };