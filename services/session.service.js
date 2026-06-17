// services/session.service.js
const mongoose = require("mongoose");
const sessionRepo = require("../repositories/session.repository");
const releaseEscrow = require("../utils/releaseEscrow");
const refundSlot = require("../utils/refundSlot");
const { generateSlotsFromSpecificDates } = require("../utils/generateSlots");
const logger = require("../utils/logger");
const {
    sendSlotCancelledEmail,
    sendSlotRescheduledEmail,
    sendAdditionalSlotEmail,
} = require("../utils/emails");
const { PLATFORM_TIMEZONE } = require("../config/constants");

// Pure helpers (no I/O — easy to unit-test in isolation)
const ALLOWED_MEETING_DOMAINS = [
    "meet.google.com",
    "zoom.us",
    "teams.microsoft.com",
    "whereby.com",
    "meet.jit.si",
    "webex.com",
];

const isValidMeetingLink = (rawUrl) => {
    try {
        const url = new URL(rawUrl);
        if (url.protocol !== "https:") return false;
        const host = url.hostname.toLowerCase();
        return ALLOWED_MEETING_DOMAINS.some(
            (d) => host === d || host.endsWith(`.${d}`)
        );
    } catch {
        return false;
    }
};

const isParticipant = (connectRequest, userId) => {
    const uid = userId.toString();
    return (
        connectRequest.mentor.toString() === uid ||
        connectRequest.mentee.toString() === uid
    );
};

/**
 * Parse and validate a slotIndex param.
 * Returns { slot, idx } or null if invalid.
 */
const parseSlotIndex = (connectRequest, slotIndex) => {
    const idx = Number.parseInt(slotIndex);
    if (
        Number.isNaN(idx) ||
        idx < 0 ||
        idx >= connectRequest.selectedSlots.length
    ) {
        return null;
    }
    return { slot: connectRequest.selectedSlots[idx], idx };
};

/**
 * Compute the progress summary over active (non-cancelled) slots.
 */
const computeProgress = (selectedSlots) => {
    const activeSlots = selectedSlots.filter((s) => s.status !== "cancelled");
    const completedCount = activeSlots.filter(
        (s) => s.menteeMarked && s.mentorMarked
    ).length;
    return {
        activeSlots,
        completedCount,
        totalSlots: activeSlots.length,
        completedSlots: completedCount,
        progress:
            activeSlots.length > 0
                ? Math.round((completedCount / activeSlots.length) * 100)
                : 0,
    };
};

const DAYS = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
];

const dayFromDate = (dateStr) =>
    DAYS[new Date(`${dateStr}T00:00:00`).getDay()];

// Notification helper (lazy-populate then send email, fire-and-forget)

/**
 * Fire-and-forget: populate the session, then send a notification email.
 * Extracted to remove duplication across addSlot/cancelSlot/rescheduleSlot.
 */
const sendNotificationAfterPopulate = (connectRequestId, emailFn, buildPayload) => {
    sessionRepo.findSessionPopulated(connectRequestId)
        .then((populated) => {
            const payload = buildPayload(populated);
            emailFn(payload).catch((err) =>
                logger.error("Notification email failed", { error: err.message })

            );
        })
        .catch((err) =>
            logger.error("Failed to populate for notification email", { error: err.message })

        );
};

// Socket helpers (lazy-require avoids circular-dep issues)

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

// Shared guards

const assertSessionAccess = (connectRequest, userId, connectRequestId) => {
    if (!connectRequest) {
        const err = new Error("Session not found");
        err.statusCode = 404;
        throw err;
    }
    if (!isParticipant(connectRequest, userId)) {
        const err = new Error("Not authorized");
        err.statusCode = 403;
        throw err;
    }
};

const assertOngoing = (connectRequest) => {
    if (connectRequest.status !== "ongoing") {
        const err = new Error("Session is not active");
        err.statusCode = 400;
        throw err;
    }
};

/**
 * Shared setup for slot-mutating endpoints: loads the session (optionally
 * within a mongo transaction), checks access/ongoing status, and validates
 * the slot index. Throws on any failure.
 * Extracted to remove duplication across setMeetingLink/markSlotComplete/cancelSlot/rescheduleSlot.
 */
const loadAndValidateSlot = async (connectRequestId, slotIndex, userId, mongoSession = null) => {
    const connectRequest = mongoSession
        ? await sessionRepo.findSessionDocumentWithSession(connectRequestId, mongoSession)
        : await sessionRepo.findSessionDocument(connectRequestId);

    assertSessionAccess(connectRequest, userId, connectRequestId);
    assertOngoing(connectRequest);

    const validated = parseSlotIndex(connectRequest, slotIndex);
    if (!validated) {
        const err = new Error("Invalid slot index");
        err.statusCode = 400;
        throw err;
    }

    return { connectRequest, ...validated };
};

// Shared helper for cancelSlot/rescheduleSlot — computes progress,
// broadcasts the update over sockets, and fires the notification email.

/**
 * Computes progress, broadcasts the slot update over sockets to both
 * parties, and fires a non-blocking notification email.
 * @param {Object} connectRequest
 * @param {string} connectRequestId
 * @param {string} userId - current user (excluded from emitToOther broadcast)
 * @param {string} event - "slot_cancelled" | "slot_rescheduled"
 * @param {Object} otherPayload - event-specific fields merged into emitToOther's payload
 * @param {Function} emailFn - e.g. sendSlotCancelledEmail / sendSlotRescheduledEmail
 * @param {Function} buildEmailPayload - (populated) => {...}
 * @returns {{connectRequestId: string, slots: Array, totalSlots: number, completedSlots: number, progress: number}}
 */
const finalizeSlotMutation = (connectRequest, connectRequestId, userId, event, otherPayload, emailFn, buildEmailPayload) => {
    const { totalSlots, completedSlots, progress } = computeProgress(connectRequest.selectedSlots);

    const socketPayload = {
        connectRequestId,
        slots: connectRequest.selectedSlots,
        totalSlots,
        completedSlots,
        progress,
    };

    emitSlotUpdate(connectRequest, socketPayload);
    emitToOther({ connectRequest, currentUserId: userId, event, payload: { connectRequestId, ...otherPayload } });
    sendNotificationAfterPopulate(connectRequestId, emailFn, buildEmailPayload);

    return socketPayload;
};

// Pure helper — builds the completion message (fixes nested ternary lint)
const buildCompleteMessage = (allComplete, bothMarked, isMentee) => {
    if (allComplete) return "All sessions complete! Tokens released to mentor.";
    if (bothMarked) return "Session marked complete by both parties.";
    const waiting = isMentee ? "mentor" : "mentee";
    return `Session marked complete. Waiting for ${waiting} to confirm.`;
};

// Pure helper — validates and applies the mark for one role
// Extracted to reduce cognitive complexity of markSlotComplete

const applyMark = ({ slot, slotRef, isMentee, isMentor }) => {
    if (isMentee) {
        if (slot.menteeMarked) {
            const err = new Error("You have already marked this session complete");
            err.statusCode = 400;
            throw err;
        }
        slotRef.menteeMarked = true;
    }

    if (isMentor) {
        if (slot.mentorMarked) {
            const err = new Error("You have already marked this session complete");
            err.statusCode = 400;
            throw err;
        }
        slotRef.mentorMarked = true;
    }
};

// GET /api/sessions/:connectRequestId/slots

const getSlots = async (connectRequestId, userId) => {
    const connectRequest = await sessionRepo.findSessionForRead(connectRequestId);
    assertSessionAccess(connectRequest, userId, connectRequestId);

    const { totalSlots, completedSlots, progress } = computeProgress(
        connectRequest.selectedSlots
    );

    return {
        slots: connectRequest.selectedSlots,
        additionalSlots: connectRequest.additionalSlots || [],
        totalSlots,
        completedSlots,
        progress,
    };
};

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/meeting-link

const setMeetingLink = async ({ connectRequestId, slotIndex, meetingLink, userId }) => {
    if (!meetingLink?.trim()) {
        const err = new Error("meetingLink is required");
        err.statusCode = 400;
        throw err;
    }
    if (!isValidMeetingLink(meetingLink.trim())) {
        const err = new Error(
            "Only links from trusted platforms (Google Meet, Zoom, etc.) are allowed."
        );
        err.statusCode = 400;
        throw err;
    }

    const { connectRequest, idx } = await loadAndValidateSlot(connectRequestId, slotIndex, userId);

    connectRequest.selectedSlots[idx].meetingLink = meetingLink.trim();
    connectRequest.markModified("selectedSlots");
    await connectRequest.save();

    const { totalSlots, completedSlots, progress } = computeProgress(
        connectRequest.selectedSlots
    );

    emitSlotUpdate(connectRequest, {
        connectRequestId,
        slots: connectRequest.selectedSlots,
        totalSlots,
        completedSlots,
        progress,
    });

    return {
        slot: connectRequest.selectedSlots[idx],
        slotIndex: idx,
    };
};

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/mark-complete

const markSlotComplete = async (connectRequestId, slotIndex, userId) => {
    const mongoSession = await mongoose.startSession();
    mongoSession.startTransaction();

    try {
        const { connectRequest, idx } = await loadAndValidateSlot(
            connectRequestId, slotIndex, userId, mongoSession
        );
        const slot = connectRequest.selectedSlots[idx];

        if (slot.status === "cancelled") {
            const err = new Error("Cannot mark a cancelled slot as complete");
            err.statusCode = 400;
            throw err;
        }

        if (slot.menteeMarked && slot.mentorMarked) {
            const err = new Error(
                "This session is already marked complete by both parties"
            );
            err.statusCode = 400;
            throw err;
        }

        const isMentor = connectRequest.mentor.toString() === userId.toString();
        const isMentee = connectRequest.mentee.toString() === userId.toString();

        // FIX: extracted role-marking into applyMark() to reduce cognitive complexity
        applyMark({ slot, slotRef: connectRequest.selectedSlots[idx], isMentee, isMentor });

        const bothMarked =
            connectRequest.selectedSlots[idx].menteeMarked &&
            connectRequest.selectedSlots[idx].mentorMarked;

        if (bothMarked) {
            connectRequest.selectedSlots[idx].completedAt = new Date();
        }

        connectRequest.markModified("selectedSlots");
        await connectRequest.save({ session: mongoSession });

        const { activeSlots, totalSlots, completedSlots, progress } =
            computeProgress(connectRequest.selectedSlots);

        const allComplete =
            activeSlots.length > 0 &&
            activeSlots.every((s) => s.menteeMarked && s.mentorMarked);

        let releaseResult = null;
        if (allComplete) {
            releaseResult = await releaseEscrow(connectRequestId, mongoSession);
        }

        await mongoSession.commitTransaction();

        const socketPayload = {
            connectRequestId,
            slots: connectRequest.selectedSlots,
            totalSlots,
            completedSlots,
            progress,
            allComplete,
        };
        emitSlotUpdate(connectRequest, socketPayload);

        // FIX: extracted nested ternary into buildCompleteMessage()
        const message = buildCompleteMessage(allComplete, bothMarked, isMentee);

        return {
            slot: connectRequest.selectedSlots[idx],
            slotIndex: idx,
            bothMarked,
            allComplete,
            completedSlots,
            totalSlots,
            progress,
            escrowRelease: releaseResult,
            message,
        };
    } catch (err) {
        await mongoSession.abortTransaction();
        logger.error("Unhandled error in session.service", {
            error: err.message,
            stack: err.stack
        });
        throw err;
    } finally {
        mongoSession.endSession();
    }
};

// POST /api/sessions/:connectRequestId/add-slot

const addSlot = async (connectRequestId, body, userId) => {
    let { day, date, startTime, endTime } = body;

    if (!date || !startTime || !endTime) {
        const err = new Error("date, startTime and endTime are required");
        err.statusCode = 400;
        throw err;
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
        const err = new Error("This slot already exists in the session");
        err.statusCode = 409;
        throw err;
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

    // FIX: .at(-1) instead of [….length - 1]
    const savedAdditionalSlot = connectRequest.additionalSlots.at(-1);

    const { totalSlots, completedSlots, progress } = computeProgress(
        connectRequest.selectedSlots
    );

    const socketPayload = {
        connectRequestId,
        slots: connectRequest.selectedSlots,
        additionalSlots: connectRequest.additionalSlots,
        totalSlots,
        completedSlots,
        progress,
    };
    emitSlotUpdate(connectRequest, socketPayload);

    // Non-blocking email — populate then send
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

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/cancel

// FIX: moved `reason` default param to last position
const cancelSlot = async ({ connectRequestId, slotIndex, userId, reason = "" }) => {
    const { connectRequest, idx } = await loadAndValidateSlot(connectRequestId, slotIndex, userId);
    const slot = connectRequest.selectedSlots[idx];

    if (slot.status === "cancelled") {
        const err = new Error("This slot is already cancelled");
        err.statusCode = 400;
        throw err;
    }
    if (slot.menteeMarked && slot.mentorMarked) {
        const err = new Error("Cannot cancel a completed slot");
        err.statusCode = 400;
        throw err;
    }

    const isMentor = connectRequest.mentor.toString() === userId.toString();
    const cancelledBy = isMentor ? "mentor" : "mentee";

    connectRequest.selectedSlots[idx].status = "cancelled";
    connectRequest.selectedSlots[idx].cancelledBy = cancelledBy;
    connectRequest.selectedSlots[idx].cancelledAt = new Date();
    connectRequest.selectedSlots[idx].cancellationReason = reason.trim();
    connectRequest.markModified("selectedSlots");
    await connectRequest.save({ validateBeforeSave: false });

    // Non-blocking partial refund
    let refundResult = null;
    try {
        if (connectRequest.paymentStatus === "paid") {
            refundResult = await refundSlot({
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

// PATCH /api/sessions/:connectRequestId/slots/:slotIndex/reschedule

const rescheduleSlot = async ({ connectRequestId, slotIndex, body, userId }) => {
    const { date, startTime, endTime } = body;

    if (!date || !startTime || !endTime) {
        const err = new Error(
            "date, startTime, and endTime are required for the new slot"
        );
        err.statusCode = 400;
        throw err;
    }

    const { connectRequest, idx } = await loadAndValidateSlot(connectRequestId, slotIndex, userId);
    const oldSlot = connectRequest.selectedSlots[idx];

    if (oldSlot.status === "cancelled") {
        const err = new Error("This slot is already cancelled");
        err.statusCode = 400;
        throw err;
    }
    if (oldSlot.menteeMarked && oldSlot.mentorMarked) {
        const err = new Error("Cannot reschedule a completed slot");
        err.statusCode = 400;
        throw err;
    }

    const newSlotTaken = connectRequest.selectedSlots.find(
        (s) =>
            s.date === date &&
            s.startTime === startTime &&
            s.endTime === endTime &&
            s.status !== "cancelled"
    );
    if (newSlotTaken) {
        const err = new Error("The new slot is already booked");
        err.statusCode = 409;
        throw err;
    }

    const newDay = dayFromDate(date);

    // Cancel old slot, mark as rescheduled
    connectRequest.selectedSlots[idx].status = "cancelled";
    connectRequest.selectedSlots[idx].cancelledBy = "mentee";
    connectRequest.selectedSlots[idx].cancelledAt = new Date();
    connectRequest.selectedSlots[idx].cancellationReason = "rescheduled";
    connectRequest.selectedSlots[idx].isRescheduled = true;

    // Append new slot
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

// GET /api/sessions/:connectRequestId/mentor-availability

const getMentorAvailability = async (connectRequestId, userId, duration = 60) => {
    const connectRequest = await sessionRepo.findSessionForRead(connectRequestId);
    assertSessionAccess(connectRequest, userId, connectRequestId);

    const availability = await sessionRepo.findMentorAvailability(
        connectRequest.mentor
    );

    // FIX: optional chain instead of || for length check
    if (!availability?.specificDates?.length) {
        return { slots: [], timezone: PLATFORM_TIMEZONE };
    }

    // All non-cancelled slots are blocked in the picker
    const bookedSlots = [
        ...(connectRequest.selectedSlots || []).filter((s) => s.status !== "cancelled"),
        ...(connectRequest.additionalSlots || []),
    ].map((s) => ({ date: s.date, startTime: s.startTime, endTime: s.endTime }));

    const grouped = generateSlotsFromSpecificDates(
        availability.specificDates,
        duration,
        bookedSlots
    );

    return {
        slots: grouped,
        timezone: availability.timezone || PLATFORM_TIMEZONE,
        sessionDurations: availability.sessionDurations || [30, 60],
    };
};

module.exports = {
    getSlots,
    setMeetingLink,
    markSlotComplete,
    addSlot,
    cancelSlot,
    rescheduleSlot,
    getMentorAvailability,
    // Exported for unit tests
    _helpers: { isValidMeetingLink, isParticipant, parseSlotIndex, computeProgress, dayFromDate },
};