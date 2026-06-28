/**
 * services/slotMutation.service.js
 *
 * Handles all slot-level mutations within an ongoing session:
 *   - getSlots / getMentorAvailability (reads)
 *   - setMeetingLink
 *   - addSlot
 *   - cancelSlot
 *   - rescheduleSlot
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

const createSlotMutationService = (sessionRepo, escrowRepo, { logger }) => {

    // ── Notification helper ───────────────────────────────────────────────────

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