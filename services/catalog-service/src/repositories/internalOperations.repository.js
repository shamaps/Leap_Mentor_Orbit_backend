const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const MentorProfile = require("@leapmentor/shared/models/MentorProfile");
const Availability = require("@leapmentor/shared/models/Availability");

const findSession = (requestId) =>
    ConnectRequest.findById(requestId).select("mentor mentee status selectedSlots");

const findSessionDocument = (requestId) => ConnectRequest.findById(requestId);

const markParticipantComplete = async ({ requestId, slotIndex, participant }) => {
    const field = participant === "mentor" ? "mentorMarked" : "menteeMarked";
    const result = await ConnectRequest.updateOne(
        {
            _id: requestId,
            [`selectedSlots.${slotIndex}.status`]: { $ne: "cancelled" },
        },
        { $set: { [`selectedSlots.${slotIndex}.${field}`]: true } }
    );
    return result.matchedCount > 0;
};

const markCompletedAtIfMissing = (requestId, slotIndex, completedAt) =>
    ConnectRequest.updateOne(
        {
            _id: requestId,
            [`selectedSlots.${slotIndex}.menteeMarked`]: true,
            [`selectedSlots.${slotIndex}.mentorMarked`]: true,
            [`selectedSlots.${slotIndex}.completedAt`]: null,
        },
        { $set: { [`selectedSlots.${slotIndex}.completedAt`]: completedAt } }
    );

const updateMentorRating = async (mentorId, avgRating, ratingCount) => {
    const profile = await MentorProfile.findOneAndUpdate(
        { user: mentorId, $or: [{ ratingCount: { $lte: ratingCount } }, { ratingCount: { $exists: false } }] },
        { $set: { avgRating, ratingCount } },
        { new: true, runValidators: true }
    ).select("user avgRating ratingCount");
    if (profile) return profile;
    return MentorProfile.findOne({ user: mentorId }).select("user avgRating ratingCount");
};

const findMentorAvailability = (mentorId) =>
    Availability.findOne({ mentor: mentorId }).select("timezone sessionDurations specificDates").lean();

const saveSession = (session) => session.save({ validateBeforeSave: false });

const confirmBooking = ({ requestId, mentorId, confirmedSlot }) => ConnectRequest.findOneAndUpdate(
    {
        _id: requestId,
        mentor: mentorId,
        status: "pending",
        selectedSlots: { $elemMatch: { date: confirmedSlot.date, startTime: confirmedSlot.startTime, endTime: confirmedSlot.endTime } },
    },
    { $set: { confirmedSlot } },
    { new: true, runValidators: true }
);

const applyReschedule = ({ requestId, slotIndex, date, startTime, endTime, newSlot }) => {
    const prefix = `selectedSlots.${slotIndex}`;
    return ConnectRequest.findOneAndUpdate(
        {
            _id: requestId,
            status: "ongoing",
            [`${prefix}.status`]: { $ne: "cancelled" },
            selectedSlots: { $not: { $elemMatch: { date, startTime, endTime, status: { $ne: "cancelled" } } } },
        },
        {
            $set: {
                [`${prefix}.status`]: "cancelled",
                [`${prefix}.cancelledBy`]: "mentee",
                [`${prefix}.cancelledAt`]: new Date(),
                [`${prefix}.cancellationReason`]: "rescheduled",
                [`${prefix}.isRescheduled`]: true,
            },
            $push: { selectedSlots: newSlot },
        },
        { new: true, runValidators: false }
    );
};

module.exports = { findSession, findSessionDocument, saveSession, confirmBooking, applyReschedule, markParticipantComplete, markCompletedAtIfMissing, updateMentorRating, findMentorAvailability };
