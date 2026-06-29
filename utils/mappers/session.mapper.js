// utils/mappers/session.mapper.js
const toSlotDTO = (slot) => ({
    id: slot._id,
    _id: slot._id,
    day: slot.day,
    date: slot.date,
    startTime: slot.startTime,
    endTime: slot.endTime,
    meetingLink: slot.meetingLink || "",
    status: slot.status,
    menteeMarked: slot.menteeMarked,
    mentorMarked: slot.mentorMarked,
    completedAt: slot.completedAt,
    cancelledBy: slot.cancelledBy,
    cancelledAt: slot.cancelledAt,
    cancellationReason: slot.cancellationReason || "",
    isRescheduled: slot.isRescheduled,
    paymentStatus: slot.paymentStatus,
    sessionRate: slot.sessionRate,
});

const toSessionSlotsDTO = (connectRequest) => ({
    slots: connectRequest.selectedSlots.map(toSlotDTO),
    additionalSlots: (connectRequest.additionalSlots || []).map(toSlotDTO),
    totalSlots: connectRequest._totalSlots,
    completedSlots: connectRequest._completedSlots,
    progress: connectRequest._progress,
});

const toMarkCompleteDTO = (data) => ({
    slot: toSlotDTO(data.slot),
    slotIndex: data.slotIndex,
    bothMarked: data.bothMarked,
    allComplete: data.allComplete,
    completedSlots: data.completedSlots,
    totalSlots: data.totalSlots,
    progress: data.progress,
    escrowRelease: data.escrowRelease,
    message: data.message,
});

const toAvailabilityDTO = (data) => ({
    slots: data.slots,
    timezone: data.timezone,
    sessionDurations: data.sessionDurations || [30, 60],
});

module.exports = { toSlotDTO, toSessionSlotsDTO, toMarkCompleteDTO, toAvailabilityDTO };