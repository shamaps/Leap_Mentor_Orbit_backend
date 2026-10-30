// repositories/session.repository.js
const ConnectRequest = require("@leapmentor/shared/models/ConnectRequest");
const logger = require("@leapmentor/shared/utils/logger");
const mongoose = require("mongoose");
// ─── ConnectRequest queries ──────────────────────────────────────────

/**
 * Fetch a session with only the fields needed for slot reads.
 * Returns a plain object (lean).
 * * @function findSessionForRead
 * @param {string} connectRequestId - Primary selection locator index string.
 * @returns {Promise<Object|null>} Lean document representation context layout blueprint, or null.
 */
const findSessionForRead = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee selectedSlots additionalSlots status paymentStatus")
        .lean();

/**
 * Fetch a live Mongoose document (needed for mutations / markModified / save).
 * * @function findSessionDocument
 * @param {string} connectRequestId - Target lookup indicator tracking records.
 * @returns {Promise<import('mongoose').Document|null>} Live record model template instance pointer, or null.
 */
const findSessionDocument = (connectRequestId) => {
    logger.debug("findSessionDocument called", { connectRequestId: connectRequestId?.toString() });
    return ConnectRequest.findById(connectRequestId);
};
const markRequestCompleted = (requestId) =>
    ConnectRequest.updateOne(
        { _id: requestId, status: { $ne: "completed" } },
        { $set: { status: "completed", completedAt: new Date() } }
    );

const markPaymentRefunded = (requestId) =>
    ConnectRequest.updateOne(
        { _id: requestId, paymentStatus: { $ne: "refunded" } },
        { $set: { paymentStatus: "refunded" } }
    );

/**
 * Fetch a live Mongoose document inside a MongoDB session (for transactions).
 * * @function findSessionDocumentWithSession
 * @param {string} connectRequestId - Database row locator index selection string.
 * @param {import('mongoose').ClientSession} mongoSession - Active transactional context boundary isolation wrapper.
 * @returns {Promise<import('mongoose').Document|null>} Transaction-scoped active document template instance, or null.
 */
const findSessionDocumentWithSession = (connectRequestId, mongoSession) => {
    logger.debug("findSessionDocumentWithSession called", { connectRequestId: connectRequestId?.toString() });
    return ConnectRequest.findById(connectRequestId).session(mongoSession);
};

/**
 * Fetch a session with mentor + mentee populated (name + email only).
 * Used for email notifications.
 * * @function findSessionPopulated
 * @param {string} connectRequestId - Target selection locator tracking index key string.
 * @returns {Promise<Object|null>} Fully populated model document row instance context.
 */
const findSessionPopulated = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .populate("mentor", "name email")
        .populate("mentee", "name email");

// ─── Session mutations (moved from catalog-service) ─────────────────
// Engagement owns ConnectRequest, so these writes live here.

const findSession = (requestId) =>
    ConnectRequest.findById(requestId).select("mentor mentee status selectedSlots");

const saveSession = (session) => session.save({ validateBeforeSave: false });

const markParticipantComplete = async ({ requestId, slotIndex, participant }) => {
    const field = participant === "mentor" ? "mentorMarked" : "menteeMarked";
    const result = await ConnectRequest.updateOne(
        { _id: requestId, [`selectedSlots.${slotIndex}.status`]: { $ne: "cancelled" } },
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

const confirmBooking = ({ requestId, mentorId, confirmedSlot }) => ConnectRequest.findOneAndUpdate(
    {
        _id: requestId,
        mentor: mentorId,
        status: "pending",
        selectedSlots: { $elemMatch: { date: confirmedSlot.date, startTime: confirmedSlot.startTime, endTime: confirmedSlot.endTime } },
    },
    { $set: { confirmedSlot } },
    { returnDocument: "after", runValidators: true }
);

const applyReschedule = ({ requestId, slotIndex, date, startTime, endTime, newSlot }) => {
    const prefix = `selectedSlots.${slotIndex}`;
    const slotWithId = { ...newSlot, _id: new mongoose.Types.ObjectId() };

    return ConnectRequest.findOneAndUpdate(
        {
            _id: requestId,
            status: "ongoing",
            [`${prefix}.status`]: { $ne: "cancelled" },
            selectedSlots: { $not: { $elemMatch: { date, startTime, endTime, status: { $ne: "cancelled" } } } },
        },
        [
            {
                $set: {
                    selectedSlots: {
                        $concatArrays: [
                            {
                                $map: {
                                    input: { $range: [0, { $size: "$selectedSlots" }] },
                                    as: "i",
                                    in: {
                                        $cond: [
                                            { $eq: ["$$i", slotIndex] },
                                            {
                                                $mergeObjects: [
                                                    { $arrayElemAt: ["$selectedSlots", "$$i"] },
                                                    {
                                                        status: "cancelled",
                                                        cancelledBy: "mentee",
                                                        cancelledAt: "$$NOW",
                                                        cancellationReason: "rescheduled",
                                                        isRescheduled: true,
                                                    },
                                                ],
                                            },
                                            { $arrayElemAt: ["$selectedSlots", "$$i"] },
                                        ],
                                    },
                                },
                            },
                            [{ $literal: slotWithId }],
                        ],
                    },
                },
            },
        ],
        { returnDocument: "after", runValidators: false, updatePipeline: true }
    );
};
// Availability is read from Catalog through its authenticated internal API.

module.exports = {
    markRequestCompleted,
    markPaymentRefunded,
    findSessionForRead,
    findSessionDocument,
    findSessionDocumentWithSession,
    findSessionPopulated,
    findSession,
    saveSession,
    markParticipantComplete,
    markCompletedAtIfMissing,
    confirmBooking,
    applyReschedule,
};