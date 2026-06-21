// repositories/session.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const Availability = require("../models/Availability");
const logger = require("../utils/logger");
// ─────────────────────────────────────────────────────────────
// ConnectRequest queries
// ─────────────────────────────────────────────────────────────

/**
 * Fetch a session with only the fields needed for slot reads.
 * Returns a plain object (lean).
 */
const findSessionForRead = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .select("mentor mentee selectedSlots additionalSlots status paymentStatus")
        .lean();

/**
 * Fetch a live Mongoose document (needed for mutations / markModified / save).
 */
const findSessionDocument = (connectRequestId) => {
    logger.debug("findSessionDocument called", { connectRequestId: connectRequestId?.toString() });
    return ConnectRequest.findById(connectRequestId);
};

/**
 * Fetch a live Mongoose document inside a MongoDB session (for transactions).
 */
const findSessionDocumentWithSession = (connectRequestId, mongoSession) => {
    logger.debug("findSessionDocumentWithSession called", { connectRequestId: connectRequestId?.toString() });
    return ConnectRequest.findById(connectRequestId).session(mongoSession);
};
/**
 * Fetch a session with mentor + mentee populated (name + email only).
 * Used for email notifications.
 */
const findSessionPopulated = (connectRequestId) =>
    ConnectRequest.findById(connectRequestId)
        .populate("mentor", "name email")
        .populate("mentee", "name email");

// ─────────────────────────────────────────────────────────────
// Availability queries
// ─────────────────────────────────────────────────────────────

/**
 * Fetch the mentor's availability document (plain object).
 */
const findMentorAvailability = (mentorId) =>
    Availability.findOne({ mentor: mentorId }).lean();

// ─────────────────────────────────────────────────────────────
module.exports = {
    findSessionForRead,
    findSessionDocument,
    findSessionDocumentWithSession,
    findSessionPopulated,
    findMentorAvailability,
};