// repositories/session.repository.js
const ConnectRequest = require("../models/ConnectRequest");
const Availability = require("../models/Availability");
const logger = require("../utils/logger");

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

// ─── Availability queries ─────────────────────────────────────────────

/**
 * Fetch the mentor's availability document (plain object).
 * * @function findMentorAvailability
 * @param {string} mentorId - System user record pointer matching mentor criteria.
 * @returns {Promise<Object|null>} Un-instanced plain JavaScript map detailing availability variables.
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