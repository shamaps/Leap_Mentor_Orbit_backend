// backend/services/feedback.service.js
const AppError = require("../utils/appError");
const { toFeedbackDTO } = require("../utils/mappers/feedback.mapper");
const createFeedbackService = (repo, { logger }) => {

// Pure helpers

const getParticipantRole = (connectRequest, userId) => {
    const uid = userId.toString();
    if (connectRequest.mentor.toString() === uid) return "mentor";
    if (connectRequest.mentee.toString() === uid) return "mentee";
    return null;
};

/**
 * FIX: "Unexpected negated condition" on `slotIndex !== undefined`
 * Replaced with a positive check: returns the parsed index when present,
 * or undefined when absent — no negation needed.
 */
const parseSlotIndex = (raw) =>
    raw === undefined ? undefined : Number(raw);
/**
 * Returns true when slotIndex is a meaningful value (not undefined/null).
 * Centralises the repeated `slotIndex !== undefined && slotIndex !== null`
 * spread pattern into a single readable predicate.
 */
const hasSlotIndex = (slotIndex) =>
    slotIndex !== undefined && slotIndex !== null;

/**
 * Validates whether the caller is allowed to leave feedback for a specific slot.
 * FIX: extracted the nested `if (slotIndex ...) { if (!slot || !myMark) }` block
 * out of submitFeedback() to reduce cognitive complexity.
 */
const assertCompletionEligible = (connectRequest, fromRole, slotIndex) => {
    if (hasSlotIndex(slotIndex)) {
        const slot = connectRequest.selectedSlots?.[slotIndex];
        const myMark = fromRole === "mentee" ? slot?.menteeMarked : slot?.mentorMarked;

        logger.debug("fromRole:", fromRole, "myMark:", myMark, "slot:", slot);

        if (!slot || !myMark)
            throw new AppError(400, "Feedback can only be submitted for completed sessions");
    } else if (connectRequest.status !== "completed") {
        throw new AppError(400, "Feedback can only be submitted for completed sessions");
    }
};

/**
 * Recalculates and persists the mentor's average rating.
 * FIX: extracted the `if (fromRole === "mentee")` block out of submitFeedback()
 * to reduce cognitive complexity.
 */
const refreshMentorAvgRating = async (mentorUserId) => {
    const allFeedback = await repo.findAllFeedbackForMentor(mentorUserId);
    const totalRatings = allFeedback.reduce((sum, f) => sum + f.rating, 0);
    const newAvgRating = Number.parseFloat(
        (totalRatings / allFeedback.length).toFixed(1)
    );
    await repo.updateMentorAvgRating(mentorUserId, newAvgRating);
    logger.info(`⭐ Updated avgRating for mentor: ${newAvgRating}`);
};

// SUBMIT FEEDBACK
// parseSlotIndex / hasSlotIndex / assertCompletionEligible / refreshMentorAvgRating


const submitFeedback = async ({ connectRequestId, rating, comment, slotIndex: rawSlotIndex, userId }) => {
    if (!connectRequestId)
        throw new AppError(400, "connectRequestId is required");
    if (!rating || rating < 1 || rating > 5)
        throw new AppError(400, "rating must be between 1 and 5");

    // FIX: parseSlotIndex() eliminates the negated-condition warning
    const slotIndex = parseSlotIndex(rawSlotIndex); 

    const connectRequest = await repo.findSessionById(connectRequestId);
    if (!connectRequest)
        throw new AppError(404, "Session not found");

    const fromRole = getParticipantRole(connectRequest, userId);
    if (!fromRole)
        throw new AppError(403, "Not authorized to submit feedback for this session");

    // FIX: assertCompletionEligible() removes nested if-inside-if from this function
    assertCompletionEligible(connectRequest, fromRole, slotIndex);

    const toUserId = fromRole === "mentor"
        ? connectRequest.mentee
        : connectRequest.mentor;

    const duplicateQuery = {
        connectRequest: connectRequestId,
        from: userId,
        ...(hasSlotIndex(slotIndex) ? { slotIndex } : {}),
    };
    const existing = await repo.findExistingFeedback(duplicateQuery);
    if (existing)
        throw new AppError(409, "You have already submitted feedback for this session");

    const feedback = await repo.createFeedback({
        connectRequest: connectRequestId,
        from: userId,
        to: toUserId,
        fromRole,
        rating,
        comment: comment?.trim() || "",
        ...(hasSlotIndex(slotIndex) ? { slotIndex } : {}),
    });

    // FIX: refreshMentorAvgRating() removes if-block from this function
    if (fromRole === "mentee") {
        await refreshMentorAvgRating(toUserId);
    }

    const populated = await repo.findFeedbackById(feedback._id);
    return toFeedbackDTO(populated);
};


// GET FEEDBACK


const getFeedback = async ({ connectRequestId, userId }) => {
    const connectRequest = await repo.findSessionForRead(connectRequestId);

    if (!connectRequest)
        throw new AppError(404, "Session not found");

    const role = getParticipantRole(connectRequest, userId);
    if (!role)
        throw new AppError(403, "Not authorized to view this session's feedback");

    const allFeedback = await repo.findFeedbackBySession(connectRequestId);

    
    const myFeedback = allFeedback.find(
        (f) => f.from._id.toString() === userId.toString() && f.slotIndex == null
    ) ?? null;

    const theirFeedback = allFeedback.find(
        (f) => f.from._id.toString() !== userId.toString() && f.slotIndex == null
    ) ?? null;

    return {
        myFeedback,
        mySlotFeedback: allFeedback.filter(         
            (f) => f.from._id.toString() === userId.toString() && f.slotIndex != null
        ),
        theirFeedback: connectRequest.status === "completed" ? theirFeedback : null,
        sessionStatus: connectRequest.status,
    };
};

    return { submitFeedback, getFeedback };
};
module.exports = createFeedbackService;