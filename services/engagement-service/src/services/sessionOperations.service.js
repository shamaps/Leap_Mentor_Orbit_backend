// services/engagement-service/src/services/sessionOperations.service.js
//
// ConnectRequest slot mutations that used to live in catalog-service
// (confirmSlot, releaseSessionSlot, confirmBookingSlot, rescheduleSessionSlot).
// Engagement owns ConnectRequest, so engagement performs these writes itself.
// Every operation is idempotent: a repeat with the same input returns the same result.
const mongoose = require("mongoose");
const AppError = require("@leapmentor/shared/utils/appError");

const createSessionOperationsService = (repo) => {
    const confirmSlot = async ({ requestId, slotIndex, userId }) => {
        if (!mongoose.isValidObjectId(requestId) || !mongoose.isValidObjectId(userId)) {
            throw new AppError(400, "requestId and userId must be valid IDs");
        }
        if (!Number.isInteger(slotIndex) || slotIndex < 0) throw new AppError(400, "slotIndex must be a non-negative integer");

        const session = await repo.findSession(requestId);
        if (!session) throw new AppError(404, "Session not found");
        if (!["ongoing", "completed"].includes(session.status)) throw new AppError(409, "Only ongoing sessions can be confirmed");
        const participant = session.mentor.toString() === userId.toString()
            ? "mentor"
            : session.mentee.toString() === userId.toString() ? "mentee" : null;
        if (!participant) throw new AppError(403, "User is not a participant in this session");
        if (!session.selectedSlots?.[slotIndex]) throw new AppError(404, "Session slot not found");
        if (session.selectedSlots[slotIndex].status === "cancelled") throw new AppError(409, "Cannot confirm a cancelled slot");

        const participantField = participant === "mentor" ? "mentorMarked" : "menteeMarked";
        if (session.status === "completed") {
            if (!session.selectedSlots[slotIndex][participantField]) throw new AppError(409, "Completed session slot has no matching confirmation");
            return { requestId, slotIndex, slot: session.selectedSlots[slotIndex], participant, bothMarked: true };
        }

        const matched = await repo.markParticipantComplete({ requestId, slotIndex, participant });
        if (!matched) throw new AppError(409, "Session slot could not be confirmed");
        const markedSession = await repo.findSession(requestId);
        const slot = markedSession.selectedSlots[slotIndex];
        const bothMarked = Boolean(slot.menteeMarked && slot.mentorMarked);
        if (bothMarked && !slot.completedAt) {
            await repo.markCompletedAtIfMissing(requestId, slotIndex, new Date());
        }
        const finalSession = bothMarked ? await repo.findSession(requestId) : markedSession;
        return { requestId, slotIndex, slot: finalSession.selectedSlots[slotIndex], participant, bothMarked };
    };
    const resolveEscrowSlot = (session, index) => {
        const seen = new Set();
        let current = index;
        while (session.selectedSlots[current]?.rescheduledFromIndex != null && !seen.has(current)) {
            seen.add(current);
            current = session.selectedSlots[current].rescheduledFromIndex;
        }
        const origin = session.selectedSlots[current];
        const additional = (session.additionalSlots || []).find(
            (s) => origin && s.date === origin.date && s.startTime === origin.startTime && s.endTime === origin.endTime
        );
        return {
            escrowSlotIndex: current,
            escrowSlotId: additional ? String(additional._id) : null,
            refundable: additional ? additional.paymentStatus === "paid" : true,
        };
    };
    const releaseSessionSlot = async ({ requestId, slotIndex, cancelledBy, reason = "" }) => {
        if (!mongoose.isValidObjectId(requestId)) throw new AppError(400, "requestId must be a valid ID");
        if (!Number.isInteger(slotIndex) || slotIndex < 0) throw new AppError(400, "slotIndex must be a non-negative integer");
        if (!["mentor", "mentee"].includes(cancelledBy)) throw new AppError(400, "cancelledBy must be mentor or mentee");
        const session = await repo.findSessionDocument(requestId);
        if (!session) throw new AppError(404, "Session not found");
        if (session.status !== "ongoing") throw new AppError(409, "Only ongoing session slots can be released");
        const slot = session.selectedSlots?.[slotIndex];
        if (!slot) throw new AppError(404, "Session slot not found");
        if (slot.menteeMarked && slot.mentorMarked) throw new AppError(409, "Cannot release a completed slot");
        if (slot.status !== "cancelled") {
            slot.status = "cancelled";
            slot.cancelledBy = cancelledBy;
            slot.cancelledAt = new Date();
            slot.cancellationReason = String(reason).trim().slice(0, 500);
            session.markModified("selectedSlots");
            await repo.saveSession(session);
        }
        return {
            requestId: String(requestId),
            slotIndex,
            ...resolveEscrowSlot(session, slotIndex),
            slot: session.selectedSlots[slotIndex],
        };
    };

    const confirmBookingSlot = async ({ requestId, mentorId, confirmedSlot }) => {
        if (!mongoose.isValidObjectId(requestId) || !mongoose.isValidObjectId(mentorId)) throw new AppError(400, "requestId and mentorId must be valid IDs");
        if (!confirmedSlot?.date || !confirmedSlot?.startTime || !confirmedSlot?.endTime || !confirmedSlot?.day)
            throw new AppError(400, "A complete confirmed slot is required");
        const updated = await repo.confirmBooking({ requestId, mentorId, confirmedSlot });
        if (updated) return { requestId: String(requestId), confirmedSlot: updated.confirmedSlot };
        const current = await repo.findSessionDocument(requestId);
        if (!current) throw new AppError(404, "Request not found");
        if (String(current.mentor) !== String(mentorId)) throw new AppError(403, "Only the assigned mentor can confirm a slot");
        const saved = current.confirmedSlot;
        if (current.status === "accepted" && saved?.date === confirmedSlot.date && saved?.startTime === confirmedSlot.startTime && saved?.endTime === confirmedSlot.endTime)
            return { requestId: String(requestId), confirmedSlot: saved };
        throw new AppError(409, "Request is no longer pending or the selected slot is invalid");
    };

    const rescheduleSessionSlot = async ({ requestId, slotIndex, userId, date, startTime, endTime, day }) => {
        if (!mongoose.isValidObjectId(requestId) || !mongoose.isValidObjectId(userId)) throw new AppError(400, "requestId and userId must be valid IDs");
        if (!Number.isInteger(slotIndex) || slotIndex < 0) throw new AppError(400, "slotIndex must be a non-negative integer");
        if (!date || !startTime || !endTime) throw new AppError(400, "date, startTime, and endTime are required");
        const session = await repo.findSessionDocument(requestId);
        if (!session) throw new AppError(404, "Session not found");
        if (session.status !== "ongoing") throw new AppError(409, "Only ongoing sessions can be rescheduled");
        if (![session.mentor.toString(), session.mentee.toString()].includes(String(userId))) throw new AppError(403, "User is not a participant in this session");
        const oldSlot = session.selectedSlots?.[slotIndex];
        if (!oldSlot) throw new AppError(404, "Session slot not found");
        const replay = session.selectedSlots.find((item) => item.isRescheduled && item.rescheduledFromIndex === slotIndex);
        if (oldSlot.status === "cancelled") {
            if (oldSlot.isRescheduled && replay) return { requestId: String(requestId), oldSlotIndex: slotIndex, newSlotIndex: session.selectedSlots.indexOf(replay), oldSlot, newSlot: replay };
            throw new AppError(409, "This slot is already cancelled");
        }
        if (oldSlot.menteeMarked && oldSlot.mentorMarked) throw new AppError(409, "Cannot reschedule a completed slot");
        const newSlot = {
            day, date, startTime, endTime, meetingLink: "", menteeMarked: false,
            mentorMarked: false, completedAt: null, status: "booked",
            isRescheduled: true, rescheduledFromIndex: slotIndex,
        };
        const updated = await repo.applyReschedule({ requestId, slotIndex, date, startTime, endTime, newSlot });
        if (updated) {
            return { requestId: String(requestId), oldSlotIndex: slotIndex, newSlotIndex: updated.selectedSlots.length - 1, oldSlot: updated.selectedSlots[slotIndex], newSlot: updated.selectedSlots.at(-1) };
        }
        const raced = await repo.findSessionDocument(requestId);
        const racedOldSlot = raced?.selectedSlots?.[slotIndex];
        const racedReplacement = raced?.selectedSlots?.find((item) => item.isRescheduled && item.rescheduledFromIndex === slotIndex);
        if (racedOldSlot?.isRescheduled && racedReplacement) {
            return { requestId: String(requestId), oldSlotIndex: slotIndex, newSlotIndex: raced.selectedSlots.indexOf(racedReplacement), oldSlot: racedOldSlot, newSlot: racedReplacement };
        }
        throw new AppError(409, "The slot changed while the reschedule was being applied");
    };

    // These results are stored in ServiceCompensation.result (a Mixed field) and used to travel
    // as JSON over HTTP, so return plain JSON, never live Mongoose subdocuments.
    const asJson = (fn) => async (...args) => JSON.parse(JSON.stringify(await fn(...args)));

    return {
        confirmSlot: asJson(confirmSlot),
        releaseSessionSlot: asJson(releaseSessionSlot),
        confirmBookingSlot: asJson(confirmBookingSlot),
        rescheduleSessionSlot: asJson(rescheduleSessionSlot),
    };
};

module.exports = createSessionOperationsService;