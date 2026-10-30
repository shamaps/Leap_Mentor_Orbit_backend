const mongoose = require("mongoose");
const AppError = require("@leapmentor/shared/utils/appError");

const createInternalOperationsService = (repo, slotLockService) => {
    const lockSlot = async (payload) => {
        const result = await slotLockService.lockSlot(payload);
        if (result.status >= 400) throw new AppError(result.status, result.body.message, { code: result.body.code });
        return result.body;
    };
    const recordCompletedSession = async ({ mentorId, requestId }) => {
        if (!mongoose.isValidObjectId(mentorId)) {
            throw new AppError(400, "mentorId must be a valid ID");
        }

        if (!mongoose.isValidObjectId(requestId)) {
            throw new AppError(400, "requestId must be a valid ID");
        }

        return await repo.recordCompletedSession(requestId, mentorId);
    };

    const releaseSlot = async (payload) => {
        const result = await slotLockService.unlockSlot(payload);
        if (result.status >= 400) throw new AppError(result.status, result.body.message);
        // Deleting an already-absent lock is successful, so this is safe to retry.
        return { released: true };
    };

    const updateMentorRating = async ({ mentorId, avgRating, ratingCount }) => {
        if (!mongoose.isValidObjectId(mentorId)) throw new AppError(400, "mentorId must be a valid ID");
        if (!Number.isFinite(avgRating) || avgRating < 0 || avgRating > 5) throw new AppError(400, "avgRating must be between 0 and 5");
        if (!Number.isInteger(ratingCount) || ratingCount < 0) throw new AppError(400, "ratingCount must be a non-negative integer");
        const profile = await repo.updateMentorRating(mentorId, avgRating, ratingCount);
        if (!profile) throw new AppError(404, "Mentor profile not found");
        return { mentorId, avgRating: profile.avgRating, ratingCount: profile.ratingCount };
    };

    const getMentorAvailability = async (mentorId) => {
        if (!mongoose.isValidObjectId(mentorId)) throw new AppError(400, "mentorId must be a valid ID");
        return await repo.findMentorAvailability(mentorId);
    };

    return { lockSlot, releaseSlot, updateMentorRating, getMentorAvailability, recordCompletedSession};
};

module.exports = createInternalOperationsService;