const mongoose = require("mongoose");
const AppError = require("@leapmentor/shared/utils/appError");

const createInternalOperationsService = (repo, slotLockService) => {
    const lockSlot = async (payload) => {
        const result = await slotLockService.lockSlot(payload);
        if (result.status >= 400) throw new AppError(result.status, result.body.message, { code: result.body.code });
        return result.body;
    };

    const releaseSlot = async (payload) => {
        const result = await slotLockService.unlockSlot(payload);
        if (result.status >= 400) throw new AppError(result.status, result.body.message);
        // Deleting an already-absent lock is successful, so this is safe to retry.
        return { released: true };
    };

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
        return {
            requestId,
            slotIndex,
            slot: finalSession.selectedSlots[slotIndex],
            participant,
            bothMarked,
        };
    };

    const updateMentorRating = async ({ mentorId, avgRating, ratingCount }) => {
        if (!mongoose.isValidObjectId(mentorId)) throw new AppError(400, "mentorId must be a valid ID");
        if (!Number.isFinite(avgRating) || avgRating < 0 || avgRating > 5) throw new AppError(400, "avgRating must be between 0 and 5");
        if (!Number.isInteger(ratingCount) || ratingCount < 0) throw new AppError(400, "ratingCount must be a non-negative integer");
        const profile = await repo.updateMentorRating(mentorId, avgRating, ratingCount);
        if (!profile) throw new AppError(404, "Mentor profile not found");
        // Absolute writes are retry safe; counts stop delayed stale updates overwriting newer data.
        return { mentorId, avgRating: profile.avgRating, ratingCount: profile.ratingCount };
    };

    const getMentorAvailability = async (mentorId) => {
        if (!mongoose.isValidObjectId(mentorId)) throw new AppError(400, "mentorId must be a valid ID");
        return await repo.findMentorAvailability(mentorId);
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
        return { requestId: String(requestId), slotIndex, slot: session.selectedSlots[slotIndex] };
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

    return { lockSlot, releaseSlot, confirmSlot, confirmBookingSlot, updateMentorRating, getMentorAvailability, releaseSessionSlot, rescheduleSessionSlot };
};

module.exports = createInternalOperationsService;
