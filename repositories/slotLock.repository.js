const SlotLock = require("../models/SlotLock");
const ConnectRequest = require("../models/ConnectRequest");

const findConfirmedBookings = (mentorId) =>
    ConnectRequest.find({
        mentor: mentorId,
        status: { $in: ["pending", "accepted"] },
    })
        .select("selectedSlots selectedSlot")
        .lean();

const findActiveLocks = (mentorId, date) =>
    SlotLock.find({ mentorId, date }).lean();

const upsertLock = (mentorId, date, startTime, endTime, menteeId, expiresAt) =>
    SlotLock.findOneAndUpdate(
        { mentorId, date, startTime, endTime, lockedBy: menteeId },
        { expiresAt },
        { upsert: true, new: true }
    );

const deleteLock = (mentorId, date, startTime, endTime, menteeId) =>
    SlotLock.findOneAndDelete({
        mentorId,
        date,
        startTime,
        endTime,
        lockedBy: menteeId,
    });

const deleteManyLocks = (filter) => SlotLock.deleteMany(filter);

const findActiveLocksExcludingUser = (mentorId, userId) =>
    SlotLock.find({
        mentorId,
        lockedBy: { $ne: userId },
    }).lean();

module.exports = {
    findConfirmedBookings,
    findActiveLocks,
    upsertLock,
    deleteLock,
    deleteManyLocks,
    findActiveLocksExcludingUser,
};