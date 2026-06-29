/**
 * services/slotMutation.service.js
 *
 * Handles all slot-level mutations within an ongoing session:
 * - getSlots / getMentorAvailability (reads)
 * - setMeetingLink
 * - addSlot
 * - cancelSlot
 * - rescheduleSlot
 *
 * markSlotComplete (Mongoose transaction + escrow release)
 * lives in sessionCompletion.service.js.
 */

const AppError = require("../utils/appError");
const { toSlotDTO, toAvailabilityDTO } = require("../utils/mappers/session.mapper");
const { generateSlotsFromSpecificDates } = require("../utils/generateSlots");
const {
    sendSlotCancelledEmail,
    sendSlotRescheduledEmail,
    sendAdditionalSlotEmail,
} = require("../utils/emails");
const { PLATFORM_TIMEZONE } = require("../config/constants");
const refundSlot = require("../utils/refundSlot");
const {
    assertSessionAccess,
    assertOngoing,
    parseSlotIndex,
    computeProgress,
    dayFromDate,
    isValidMeetingLink,
} = require("./sessionHelpers");

/**
 * @typedef {Object} SessionRepository
 * @property {(connectRequestId: string) => Promise<Object|null>} findSessionPopulated - Resolves connection requests populated with mentor and mentee names and emails for notifications.
 * @property {(connectRequestId: string) => Promise<Object|null>} findSessionForRead - Fetches sub-slot components via a lean database snapshot readout.
 * @property {(connectRequestId: string) => Promise<import('mongoose').Document|null>} findSessionDocument - Obtains a live Mongoose query model tracking standard document mutations.
 * @property {(connectRequestId: string, mongoSession: import('mongoose').ClientSession) => Promise<import('mongoose').Document|null>} findSessionDocumentWithSession - Obtains a transaction-scoped live Mongoose document tracking modifications.
 * @property {(mentorId: any) => Promise<Object|null>} findMentorAvailability - Resolves the availability rule configuration array bound to a specific mentor user.
 */

/**
 * @typedef {Object} SocketPayload
 * @property {string} connectRequestId - The primary timeline lane locator reference index key.
 * @property {Object[]} slots - Complete tracking collection mapping out current scheduled slots.
 * @property {number} totalSlots - Computed length boundary tracking total allocated indices.
 * @property {number} completedSlots - Amount of confirmed completed nodes present inside the collection.
 * @property {number} progress - Mathematical percentage value tracking fulfillment progress.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} info - Monitors functional milestones like successful ledger changes.
 * @property {(message: string, meta?: Object) => void} warn - Captures real-time socket delivery event warnings.
 * @property {(message: string, meta?: Object) => void} error - Captures asynchronous notification block exceptions.
 */

/**
 * Factory function constructing the comprehensive scheduling slot modification and availability reading engine.
 * * @param {SessionRepository} sessionRepo - Core repository layer providing persistence operations for connections.
 * @param {Object} escrowRepo - Core repository layer handling escrow and transaction ledger adjustments.
 * @param {{ logger: Logger }} dependencies - Telemetry monitoring diagnostics utilities parameters block.
 * @returns {Object} Grouped business validation service methods mapping schedule slot mutations.
 */
const createSlotMutationService = (sessionRepo, escrowRepo, { logger }) => {

    // ── Notification helper ───────────────────────────────────────────────────

    /**
     * Forks a background asynchronous non-blocking thread to fetch complete participant profiles before dispatching transaction notifications.
     * * @private
     * @function sendNotificationAfterPopulate
     * @param {string} connectRequestId - Target selection locator primary index key string.
     * @param {Function} emailFn - The specific email compilation task worker handler to execute.
     * @param {Function} buildPayload - Mapping callback restructuring document profiles into mail parameter criteria.
     */
    const sendNotificationAfterPopulate = (connectRequestId, emailFn, buildPayload) => {
        (async () => {
            try {
                const populated = await sessionRepo.findSessionPopulated(connectRequestId);
                const payload = buildPayload(populated);
                await emailFn(payload);
            } catch (err) {
                logger.error("Notification after populate failed", {
                    error: err.message,
                    connectRequestId,
                });
            }
        })();
    };

    // ── Socket helpers ────────────────────────────────────────────────────────

    /**
     * Broad-broadcasts updated timeline state matrices to both sides of the session room over connected web sockets.
     * * @private
     * @function emitSlotUpdate
     * @param {Object} connectRequest - The active connection record tracking owner parameters.
     * @param {Object} payload - Fully compiled socket status update metrics data layout.
     */
    const emitSlotUpdate = (connectRequest, payload) => {
        try {
            const { emitToUser } = require("../socket/socketHandler");
            if (!emitToUser) return;
            emitToUser(connectRequest.mentor.toString(), "session_slots_updated", payload);
            emitToUser(connectRequest.mentee.toString(), "session_slots_updated", payload);
        } catch (emitErr) {
            logger.warn("emitSlotUpdate failed", { error: emitErr.message });
        }
    };

    /**
     * Filters out the active calling agent to push custom real-time socket flags specifically to the opposite participant.
     * * @private
     * @function emitToOther
     * @param {Object} contextOptions - Structural parameters packaging socket connection indicators.
     * @param {Object} contextOptions.connectRequest - Parent timeline document context holding identifiers.
     * @param {any} contextOptions.currentUserId - The executing user identifier to be excluded from targets.
     * @param {string} contextOptions.event - Socket message channel taxonomic label name.
     * @param {Object} contextOptions.payload - Custom meta tracking updates context dictionary.
     */
    const emitToOther = ({ connectRequest, currentUserId, event, payload }) => {
        try {
            const { emitToUser } = require("../socket/socketHandler");
            if (!emitToUser) return;
            const otherId =
                connectRequest.mentor.toString() === currentUserId.toString()
                    ? connectRequest.mentee.toString()
                    : connectRequest.mentor.toString();
            emitToUser(otherId, event, payload);
        } catch (emitErr) {
            logger.warn("emitToOther failed", { error: emitErr.message });
        }
    };

    // ── Shared slot loader ────────────────────────────────────────────────────

    /**
     * Secure operational guard reading connection document parameters inside or outside active transactional blocks, verifying relationship bounds.
     * * @async
     * @function loadAndValidateSlot
     * @param {Object} loadParams - Coordinates package specifying target indices.
     * @param {string} loadParams.connectRequestId - Core timeline lane locator lookup reference index string.
     * @param {number|string} loadParams.slotIndex - Slicing array pointer index indicating target slot.
     * @param {any} loadParams.userId - Secure identity token verification signature key checking ownership from incoming frames.
     * @param {import('mongoose').ClientSession|null} [loadParams.mongoSession=null] - Optional isolation block needed during completion step operations.
     * @throws {AppError} 400 - If slot sub-index properties violate length bounds layouts.
     * @throws {AppError} 403 - If security credentials checks fail baseline relationship parameters bounds.
     * @throws {AppError} 404 - If database lookups resolve empty parent documents.
     * @returns {Promise<{ connectRequest: import('mongoose').Document, idx: number, slot: Object }>} Structural wrapper layout matching validated query parameters objects.
     */
    const loadAndValidateSlot = async ({ connectRequestId, slotIndex, userId, mongoSession = null }) => {
        const connectRequest = mongoSession
            ? await sessionRepo.findSessionDocumentWithSession(connectRequestId, mongoSession)
            : await sessionRepo.findSessionDocument(connectRequestId);

        assertSessionAccess(connectRequest, userId, connectRequestId);
        assertOngoing(connectRequest);

        const validated = parseSlotIndex(connectRequest, slotIndex);
        if (!validated) {
            throw new AppError(400, "Invalid slot index");
        }

        return { connectRequest, ...validated };
    };

    /**
     * Synchronizes and calculates metrics variables required to fire broad updates, push sibling socket flags, and fork notification paths.
     * * @private
     * @function finalizeSlotMutation
     * @param {import('mongoose').Document} connectRequest - Modified operational query document tracker.
     * @param {string} connectRequestId - Core session timeline lane indicator lookup reference index key string.
     * @param {any} userId - Session token authentication signature key verifying actor contexts.
     * @param {string} event - Sibling socket event taxonomy code name.
     * @param {Object} otherPayload - Custom metadata update values array collection context.
     * @param {Function} emailFn - Non-blocking background mailing module handler.
     * @param {Function} buildEmailPayload - Conversion callback mapping populated fields onto template items.
     * @returns {SocketPayload} Calculated status overview parameters block layout envelope.
     */
    const finalizeSlotMutation = (
        connectRequest, connectRequestId, userId,
        event, otherPayload, emailFn, buildEmailPayload
    ) => {
        const { totalSlots, completedSlots, progress } = computeProgress(connectRequest.selectedSlots);

        const socketPayload = {
            connectRequestId,
            slots: connectRequest.selectedSlots,
            totalSlots,
            completedSlots,
            progress,
        };

        emitSlotUpdate(connectRequest, socketPayload);
        emitToOther({
            connectRequest,
            currentUserId: userId,
            event,
            payload: { connectRequestId, ...otherPayload },
        });
        sendNotificationAfterPopulate(connectRequestId, emailFn, buildEmailPayload);

        return socketPayload;
    };

    // ── GET /api/sessions/:connectRequestId/slots ─────────────────────────────

    /**
     * Resolves compact schedule slot breakdowns and progress summaries mapped inside a session channel data view.
     * * @async
     * @function getSlots
     * @param {string} connectRequestId - Primary network path param indexing lookup rows.
     * @param {any} userId - Authenticated secure user verification checking visibility permissions boundaries.
     * @returns {Promise<{ slots: Object[], additionalSlots: Object[], totalSlots: number, completedSlots: number, progress: number }>} Mapped history metrics cards configurations.
     */
    const getSlots = async (connectRequestId, userId) => {
        const connectRequest = await sessionRepo.findSessionForRead(connectRequestId);
        assertSessionAccess(connectRequest, userId, connectRequestId);

        const { totalSlots, completedSlots, progress } = computeProgress(
            connectRequest.selectedSlots
        );

        return {
            slots: connectRequest.selectedSlots.map(toSlotDTO),
            additionalSlots: (connectRequest.additionalSlots || []).map(toSlotDTO),
            totalSlots,
            completedSlots,
            progress,
        };
    };

    // ── PATCH slots/:slotIndex/meeting-link ───────────────────────────────────

    /**
     * Updates an external communication destination hyperlink bound into specific allocated slot indexes.
     * Limits changes to trusted platform protocol headers.
     * * @async
     * @function setMeetingLink
     * @param {Object} context - Modification payload context mapping target indices.
     * @param {string} context.connectRequestId - Associated unique dynamic session line reference index key string.
     * @param {number|string} context.slotIndex - Target slice array indicator matching coordinates.
     * @param {string} context.meetingLink - Inbound clear text target address destination link string parameter.
     * @param {any} context.userId - Security identity context validation checker parameter checking ownership.
     * @throws {AppError} 400 - If link parameters are empty or verify checks classify URLs as untrusted.
     * @returns {Promise<{ slot: Object, slotIndex: number }>} Data transfer block container mapping altered fields outputs.
     */
    const setMeetingLink = async ({ connectRequestId, slotIndex, meetingLink, userId }) => {
        if (!meetingLink?.trim()) {
            throw new AppError(400, "meetingLink is required");
        }
        if (!isValidMeetingLink(meetingLink.trim())) {
            throw new AppError(400, "Only links from trusted platforms (Google Meet, Zoom, etc.) are allowed.");
        }

        const { connectRequest, idx } = await loadAndValidateSlot({ connectRequestId, slotIndex, userId });

        connectRequest.selectedSlots[idx].meetingLink = meetingLink.trim();
        connectRequest.markModified("selectedSlots");
        await connectRequest.save();

        const { totalSlots, completedSlots, progress } = computeProgress(connectRequest.selectedSlots);

        emitSlotUpdate(connectRequest, {
            connectRequestId,
            slots: connectRequest.selectedSlots,
            totalSlots,
            completedSlots,
            progress,
        });

        return { slot: toSlotDTO(connectRequest.selectedSlots[idx]), slotIndex: idx };
    };

    // ── POST add-slot ─────────────────────────────────────────────────────────

    /**
     * Appends an extra session slot onto array logs containers, enforcing overlapping booking limits rules.
     * * @async
     * @function addSlot
     * @param {string} connectRequestId - Target selection locator primary index key string.
     * @param {Object} body - Intake structural criteria configuration parameter parameters body.
     * @param {string} body.date - Target day string format.
     * @param {string} body.startTime - Opening bounding hour format index.
     * @param {string} body.endTime - Closing bounding hour format index.
     * @param {string} [body.day] - Optional text label mapping weekdays.
     * @param {any} userId - Secure user identifier validation signature pointer key checking ownership parameters.
     * @throws {AppError} 400 - If chronological bounding arguments evaluate unassigned.
     * @throws {AppError} 409 - If target parameters matching selected time blocks duplicate existing items logs.
     * @returns {Promise<Object>} Added slot node layout variables metrics combined with broad update definitions envelopes.
     */
    const addSlot = async (connectRequestId, body, userId) => {
        let { day, date, startTime, endTime } = body;

        if (!date || !startTime || !endTime) {
            throw new AppError(400, "date, startTime and endTime are required");
        }

        if (!day) day = dayFromDate(date);

        const connectRequest = await sessionRepo.findSessionDocument(connectRequestId);
        assertSessionAccess(connectRequest, userId, connectRequestId);
        assertOngoing(connectRequest);

        const slotTaken =
            connectRequest.selectedSlots.find(
                (s) =>
                    s.date === date &&
                    s.startTime === startTime &&
                    s.endTime === endTime &&
                    s.status !== "cancelled"
            ) ||
            connectRequest.additionalSlots?.find(
                (s) => s.date === date && s.startTime === startTime && s.endTime === endTime
            );

        if (slotTaken) {
            throw new AppError(409, "This slot already exists in the session");
        }

        const newAdditionalSlot = {
            day, date, startTime, endTime,
            meetingLink: "", menteeMarked: false, mentorMarked: false,
            completedAt: null, paymentStatus: "pending",
        };

        const newSelectedSlot = {
            day, date, startTime, endTime,
            meetingLink: "", menteeMarked: false, mentorMarked: false,
            completedAt: null, status: "booked",
        };

        connectRequest.additionalSlots.push(newAdditionalSlot);
        connectRequest.markModified("additionalSlots");
        connectRequest.selectedSlots.push(newSelectedSlot);
        connectRequest.markModified("selectedSlots");
        await connectRequest.save({ validateBeforeSave: false });

        const savedAdditionalSlot = connectRequest.additionalSlots.at(-1);
        const { totalSlots, completedSlots, progress } = computeProgress(connectRequest.selectedSlots);

        const socketPayload = {
            connectRequestId,
            slots: connectRequest.selectedSlots,
            additionalSlots: connectRequest.additionalSlots,
            totalSlots,
            completedSlots,
            progress,
        };
        emitSlotUpdate(connectRequest, socketPayload);

        sendNotificationAfterPopulate(connectRequestId, sendAdditionalSlotEmail, (populated) => ({
            connectRequestId,
            mentorName: populated.mentor.name,
            mentorEmail: populated.mentor.email,
            menteeName: populated.mentee.name,
            menteeEmail: populated.mentee.email,
            slot: newSelectedSlot,
        }));

        return {
            slot: newAdditionalSlot,
            slotId: savedAdditionalSlot._id,
            ...socketPayload,
        };
    };

    // ── PATCH slots/:slotIndex/cancel ─────────────────────────────────────────

    /**
     * De-authorizes schedule slots nodes, mapping actor indicators and initiating monetary token refunds through the ledger framework.
     * * @async
     * @function cancelSlot
     * @param {Object} inputContext - Operations parameters block container data.
     * @param {string} inputContext.connectRequestId - Associated unique target platform session lane index.
     * @param {number|string} inputContext.slotIndex - Target slice array indicator matching coordinates tracking slots.
     * @param {any} inputContext.userId - Secure request token context identifier checking ownership credentials.
     * @param {string} [inputContext.reason=""] - Explanatory cancelation text description parameter summary.
     * @throws {AppError} 400 - If selected slots hold cancelled markers or track validated completions flags.
     * @returns {Promise<Object>} Mutated model data results combined with transaction refund validation details.
     */
    const cancelSlot = async ({ connectRequestId, slotIndex, userId, reason = "" }) => {
        const { connectRequest, idx } = await loadAndValidateSlot({ connectRequestId, slotIndex, userId });
        const slot = connectRequest.selectedSlots[idx];

        if (slot.status === "cancelled") {
            throw new AppError(400, "This slot is already cancelled");
        }
        if (slot.menteeMarked && slot.mentorMarked) {
            throw new AppError(400, "Cannot cancel a completed slot");
        }

        const isMentor = connectRequest.mentor.toString() === userId.toString();
        const cancelledBy = isMentor ? "mentor" : "mentee";

        connectRequest.selectedSlots[idx].status = "cancelled";
        connectRequest.selectedSlots[idx].cancelledBy = cancelledBy;
        connectRequest.selectedSlots[idx].cancelledAt = new Date();
        connectRequest.selectedSlots[idx].cancellationReason = reason.trim();
        connectRequest.markModified("selectedSlots");
        await connectRequest.save({ validateBeforeSave: false });

        let refundResult = null;
        try {
            if (connectRequest.paymentStatus === "paid") {
                refundResult = await refundSlot(escrowRepo, {
                    connectRequestId,
                    slotIndex: idx,
                    cancelledBy,
                });
                logger.info(
                    `Slot #${idx + 1} refund: ${refundResult.refundedAmount} tokens returned to mentee`
                );
            }
        } catch (refundErr) {
            logger.error("Slot refund failed — slot still cancelled", { error: refundErr.message });
        }

        const trimmedReason = reason.trim();

        const socketPayload = finalizeSlotMutation(
            connectRequest, connectRequestId, userId, "slot_cancelled",
            {
                slotIndex: idx,
                slot: connectRequest.selectedSlots[idx],
                cancelledBy,
                reason: trimmedReason,
                refund: refundResult ? { amount: refundResult.refundedAmount } : null,
            },
            sendSlotCancelledEmail,
            (populated) => ({
                connectRequestId,
                mentorName: populated.mentor.name,
                mentorEmail: populated.mentor.email,
                menteeName: populated.mentee.name,
                menteeEmail: populated.mentee.email,
                slot: connectRequest.selectedSlots[idx],
                cancelledBy,
                reason: trimmedReason,
            })
        );

        return {
            slot: connectRequest.selectedSlots[idx],
            slotIndex: idx,
            refund: refundResult
                ? {
                    refundedAmount: refundResult.refundedAmount,
                    newBalance: refundResult.balance,
                    newEscrow: refundResult.escrow,
                }
                : null,
            ...socketPayload,
        };
    };

    // ── PATCH slots/:slotIndex/reschedule ─────────────────────────────────────

    /**
     * Cascades schedule adjustments by automatically flagging target older indices cancelled before pushing a newly generated replacement slot configuration node.
     * * @async
     * @function rescheduleSlot
     * @param {Object} payloadData - Operational parameters block container specifying target fields.
     * @param {string} payloadData.connectRequestId - Associated unique parent channel criteria search index.
     * @param {number|string} payloadData.slotIndex - Target slice array indicator matching coordinates tracking selection columns.
     * @param {any} payloadData.userId - Secure identity token verification signature pointer.
     * @param {Object} payloadData.body - Delta field configurations updating target variables properties.
     * @param {string} payloadData.body.date - Replacement day string format.
     * @param {string} payloadData.body.startTime - Replacement start timeline bounding format.
     * @param {string} payloadData.body.endTime - Replacement terminal timeline bounding format.
     * @throws {AppError} 400 - If new time variables are missing or targets hold cancelled indicators.
     * @throws {AppError} 409 - If replacement specifications overlap existing booked assets arrays rows.
     * @returns {Promise<Object>} Reconfigured replacement slot data models combined with broad confirmation envelopes.
     */
    const rescheduleSlot = async ({ connectRequestId, slotIndex, body, userId }) => {
        const { date, startTime, endTime } = body;

        if (!date || !startTime || !endTime) {
            throw new AppError(400, "date, startTime, and endTime are required for the new slot");
        }

        const { connectRequest, idx } = await loadAndValidateSlot({ connectRequestId, slotIndex, userId });
        const oldSlot = connectRequest.selectedSlots[idx];

        if (oldSlot.status === "cancelled") {
            throw new AppError(400, "This slot is already cancelled");
        }
        if (oldSlot.menteeMarked && oldSlot.mentorMarked) {
            throw new AppError(400, "Cannot reschedule a completed slot");
        }

        const newSlotTaken = connectRequest.selectedSlots.find(
            (s) =>
                s.date === date &&
                s.startTime === startTime &&
                s.endTime === endTime &&
                s.status !== "cancelled"
        );
        if (newSlotTaken) {
            throw new AppError(409, "The new slot is already booked");
        }

        const newDay = dayFromDate(date);

        connectRequest.selectedSlots[idx].status = "cancelled";
        connectRequest.selectedSlots[idx].cancelledBy = "mentee";
        connectRequest.selectedSlots[idx].cancelledAt = new Date();
        connectRequest.selectedSlots[idx].cancellationReason = "rescheduled";
        connectRequest.selectedSlots[idx].isRescheduled = true;

        const newSlot = {
            day: newDay, date, startTime, endTime,
            meetingLink: "", menteeMarked: false, mentorMarked: false,
            completedAt: null, status: "booked",
            isRescheduled: true, rescheduledFromIndex: idx,
        };

        connectRequest.selectedSlots.push(newSlot);
        connectRequest.markModified("selectedSlots");
        await connectRequest.save({ validateBeforeSave: false });

        const newSlotIndex = connectRequest.selectedSlots.length - 1;
        const socketPayload = finalizeSlotMutation(
            connectRequest, connectRequestId, userId, "slot_rescheduled",
            {
                oldSlotIndex: idx,
                newSlotIndex,
                oldSlot: connectRequest.selectedSlots[idx],
                newSlot: connectRequest.selectedSlots[newSlotIndex],
            },
            sendSlotRescheduledEmail,
            (populated) => ({
                connectRequestId,
                mentorName: populated.mentor.name,
                mentorEmail: populated.mentor.email,
                menteeName: populated.mentee.name,
                menteeEmail: populated.mentee.email,
                oldSlot: connectRequest.selectedSlots[idx],
                newSlot: connectRequest.selectedSlots[newSlotIndex],
            })
        );

        return {
            oldSlot: connectRequest.selectedSlots[idx],
            newSlot: connectRequest.selectedSlots[newSlotIndex],
            oldSlotIndex: idx,
            newSlotIndex,
            ...socketPayload,
        };
    };

    // ── GET mentor-availability ───────────────────────────────────────────────

    /**
     * Interrogates host availability configuration metrics models to calculate available timeline frames, filtering out overlapping session slots.
     * * @async
     * @function getMentorAvailability
     * @param {string} connectRequestId - Dialogue pipeline lookup index key string parameter.
     * @param {any} userId - Secure user verification signature key tracking active permissions.
     * @param {number} [duration=60] - Minute allocation segment window thickness criteria.
     * @returns {Promise<Object>} Formatted availability DTO detailing calculated availability segments.
     */
    const getMentorAvailability = async (connectRequestId, userId, duration = 60) => {
        const connectRequest = await sessionRepo.findSessionForRead(connectRequestId);
        assertSessionAccess(connectRequest, userId, connectRequestId);

        const availability = await sessionRepo.findMentorAvailability(
            connectRequest.mentor
        );

        if (!availability?.specificDates?.length) {
            return { slots: [], timezone: PLATFORM_TIMEZONE };
        }

        const bookedSlots = [
            ...(connectRequest.selectedSlots || []).filter((s) => s.status !== "cancelled"),
            ...(connectRequest.additionalSlots || []),
        ].map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime }));

        const grouped = generateSlotsFromSpecificDates(
            availability.specificDates,
            duration,
            bookedSlots
        );

        return toAvailabilityDTO({
            slots: grouped,
            timezone: availability.timezone || PLATFORM_TIMEZONE,
            sessionDurations: availability.sessionDurations || [30, 60],
        });
    };

    return {
        getSlots,
        setMeetingLink,
        addSlot,
        cancelSlot,
        rescheduleSlot,
        getMentorAvailability,
        // shared by sessionCompletion.service.js
        loadAndValidateSlot,
        emitSlotUpdate,
    };
};

module.exports = createSlotMutationService;