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

module.exports = { toSlotDTO };