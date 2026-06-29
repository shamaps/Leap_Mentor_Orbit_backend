// backend/services/feedback.services.js
const AppError = require("../utils/appError");
const { toFeedbackDTO } = require("../utils/mappers/feedback.mapper");

/**
 * @typedef {Object} SelectedTimeSlot
 * @property {boolean} [menteeMarked] - Completion status assigned by the mentee.
 * @property {boolean} [mentorMarked] - Completion status assigned by the mentor.
 */

/**
 * @typedef {Object} ConnectRequestDocument
 * @property {any} mentor - Unique identifier tracking the mentor.
 * @property {any} mentee - Unique identifier tracking the mentee.
 * @property {string} status - Platform operational status label.
 * @property {SelectedTimeSlot[]} [selectedSlots] - Optional matrix of distinct meeting schedule blocks.
 */

/**
 * @typedef {Object} FeedbackRepository
 * @property {(id: string) => Promise<ConnectRequestDocument|null>} findSessionById - Resolves full interactive session rows.
 * @property {(id: string) => Promise<ConnectRequestDocument|null>} findSessionForRead - High-performance read-only session snapshot.
 * @property {(query: Object) => Promise<Object|null>} findExistingFeedback - Evaluates duplicate feedback profiles.
 * @property {(data: Object) => Promise<Object>} createFeedback - Records a new feedback log schema.
 * @property {(id: any) => Promise<Object|null>} findFeedbackById - Resolves fully populated user descriptor rows.
 * @property {(connectRequestId: string) => Promise<Object[]>} findFeedbackBySession - Pulls feedback structures mapped to a session.
 * @property {(mentorUserId: any) => Promise<Object[]>} findAllFeedbackForMentor - Aggregates raw score profiles.
 * @property {(mentorUserId: any) => Promise<Object[]>} computeMentorAvgRating - Computes math averages via aggregation.
 * @property {(mentorUserId: any, avgRating: number) => Promise<Object|null>} updateMentorAvgRating - Alters historical average scores.
 */

/**
 * Factory function creating the core operational logic for the Feedback Service.
 * * @param {FeedbackRepository} repo - Data layer persistence abstraction instance.
 * @param {{ logger: Object }} dependencies - Metric tracking and application logging telemetry context.
 * @returns {Object} Operational service interface exposing feedback workflows.
 */
const createFeedbackService = (repo, { logger }) => {

    /**
     * Deduces system participation role based on session descriptors and credentials.
     * * @private
     * @function getParticipantRole
     * @param {ConnectRequestDocument} connectRequest - The target mentorship agreement model details.
     * @param {any} userId - Inbound user token primary check index key.
     * @returns {"mentor"|"mentee"|null} Role context string classification matching records.
     */
    const getParticipantRole = (connectRequest, userId) => {
        const uid = userId.toString();
        if (connectRequest.mentor.toString() === uid) return "mentor";
        if (connectRequest.mentee.toString() === uid) return "mentee";
        return null;
    };

    /**
     * Normalizes loose frontend values into strict numbers or undefined.
     * * @private
     * @function parseSlotIndex
     * @param {any} raw - Unparsed raw parameter argument context.
     * @returns {number|undefined} Standardized numeric format layout output.
     */
    const parseSlotIndex = (raw) =>
        raw === undefined ? undefined : Number(raw);

    /**
     * Asserts if a parameter value represents a valid slot indicator entry.
     * * @private
     * @function hasSlotIndex
     * @param {number|undefined|null} slotIndex - The numeric slot tracking index code.
     * @returns {boolean} True if argument conforms to structural value rules.
     */
    const hasSlotIndex = (slotIndex) =>
        slotIndex !== undefined && slotIndex !== null;

    /**
     * Enforces matching rules verifying completion metrics across custom sub-slots or top-level session limits.
     * * @private
     * @function assertCompletionEligible
     * @param {ConnectRequestDocument} connectRequest - The active interactive session document.
     * @param {"mentor"|"mentee"} fromRole - Originator role label context identifier.
     * @param {number|undefined} slotIndex - Sub-item array mapping index configuration variable.
     * @throws {AppError} 400 - If the targeted session block lacks valid internal completion markers.
     */
    const assertCompletionEligible = (connectRequest, fromRole, slotIndex) => {
        if (hasSlotIndex(slotIndex)) {
            const slot = connectRequest.selectedSlots?.[slotIndex];
            const myMark = fromRole === "mentee" ? slot?.menteeMarked : slot?.mentorMarked;

            logger.debug("Feedback debug state", { fromRole, myMark, slot });

            if (!slot || !myMark)
                throw new AppError(400, "Feedback can only be submitted for completed sessions");
        } else if (connectRequest.status !== "completed") {
            throw new AppError(400, "Feedback can only be submitted for completed sessions");
        }
    };

    /**
     * Recalculates aggregation profiles, shifting public score vectors.
     * * @private
     * @async
     * @function refreshMentorAvgRating
     * @param {any} mentorUserId - Target profile modifier index key string.
     */
    const refreshMentorAvgRating = async (mentorUserId) => {
        const [result] = await repo.computeMentorAvgRating(mentorUserId);
        const newAvgRating = result
            ? Number.parseFloat(result.avg.toFixed(1))
            : 0;
        await repo.updateMentorAvgRating(mentorUserId, newAvgRating);
        logger.info(`Updated avgRating for mentor ${mentorUserId}: ${newAvgRating} (from ${result?.count ?? 0} ratings)`);
    };

    /**
     * Validates and registers custom participant feedback log schemas, triggering average score recalculations.
     * * @async
     * @function submitFeedback
     * @param {Object} payload - Combined payload processing criteria parameters container.
     * @param {string} payload.connectRequestId - Unique system connection tracker index string.
     * @param {number} payload.rating - Quality value bounded between 1 and 5 inclusive.
     * @param {string} [payload.comment] - Literal description text explaining evaluation reasons.
     * @param {number|string} [payload.slotIndex] - Optional identifier indexing specific sub-slot elements.
     * @param {any} payload.userId - Session tracking indicator verifying originator token data.
     * @throws {AppError} 400 - If required indices are absent or score values violate scale constraints.
     * @throws {AppError} 403 - If originator indices fail relationship authorization validations.
     * @throws {AppError} 404 - If target session document search yields no valid data rows.
     * @throws {AppError} 409 - If duplicate matching items already populate tracking databases.
     * @returns {Promise<Object>} Formatted mapping DTO layout detailing transaction outputs.
     */
    const submitFeedback = async ({ connectRequestId, rating, comment, slotIndex: rawSlotIndex, userId }) => {
        if (!connectRequestId)
            throw new AppError(400, "connectRequestId is required");
        if (!rating || rating < 1 || rating > 5)
            throw new AppError(400, "rating must be between 1 and 5");

        const slotIndex = parseSlotIndex(rawSlotIndex);

        const connectRequest = await repo.findSessionById(connectRequestId);
        if (!connectRequest)
            throw new AppError(404, "Session not found");

        const fromRole = getParticipantRole(connectRequest, userId);
        if (!fromRole)
            throw new AppError(403, "Not authorized to submit feedback for this session");

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

        if (fromRole === "mentee") {
            await refreshMentorAvgRating(toUserId);
        }

        const populated = await repo.findFeedbackById(feedback._id);
        return toFeedbackDTO(populated);
    };

    /**
     * Resolves localized context matrices grouping internal feedback arrays against counterpart visibility rules.
     * * @async
     * @function getFeedback
     * @param {Object} input - Query definition boundaries container payload.
     * @param {string} input.connectRequestId - Unique primary lookup search index string.
     * @param {any} input.userId - Secure identity token verification signature.
     * @throws {AppError} 403 - If identity checks reveal user context fails basic partnership constraints.
     * @throws {AppError} 404 - If structural database queries return empty results.
     * @returns {Promise<{myFeedback: Object|null, mySlotFeedback: Object[], theirFeedback: Object|null, sessionStatus: string}>} Grouped visibility properties container layout details.
     */
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