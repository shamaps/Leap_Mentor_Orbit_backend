// repositories/slotLock.repository.js
const SlotLock = require("../models/SlotLock");
const ConnectRequest = require("../models/ConnectRequest");

/**
 * Queries active mentorship requests tracking blocks matching established schedule criteria.
 * * @function findConfirmedBookings
 * @param {string} mentorId - Target lookup locator index primary key string.
 * @returns {Promise<Object[]>} Collection array of lean plain objects containing selected slots properties.
 */
const findConfirmedBookings = (mentorId) =>
    ConnectRequest.find({
        mentor: mentorId,
        status: { $in: ["pending", "accepted"] },
    })
        .select("selectedSlots selectedSlot")
        .lean();

/**
 * Pulls a collection array containing all active unexpired holds matching specified calendar days.
 * * @function findActiveLocks
 * @param {string} mentorId - Associated unique target provider selector tracking rows.
 * @param {string} date - Calendar query criteria text string parameter.
 * @returns {Promise<Object[]>} Collection listing active lock document variables registries.
 */
const findActiveLocks = (mentorId, date) =>
    SlotLock.find({ mentorId, date }).lean();

/**
 * Refreshes the caller's own existing lock timer on this exact slot, if they already hold it.
 * Does NOT create a new lock and does NOT touch another mentee's lock — returns null if the
 * caller doesn't currently own a lock on this exact slot (see createLock for that case).
 * * @function refreshOwnLock
 * @param {Object} payloadFields
 * @param {string} payloadFields.mentorId
 * @param {string} payloadFields.date
 * @param {string} payloadFields.startTime
 * @param {string} payloadFields.endTime
 * @param {any} payloadFields.menteeId
 * @param {Date} payloadFields.expiresAt
 * @returns {Promise<Object|null>} The refreshed lock, or null if the caller doesn't own one here.
 */
const refreshOwnLock = ({ mentorId, date, startTime, endTime, menteeId, expiresAt }) =>
    SlotLock.findOneAndUpdate(
        { mentorId, date, startTime, endTime, lockedBy: menteeId },
        { expiresAt },
        { new: true }
    );

/**
 * Atomically claims a brand-new lock on this exact slot. Relies on the unique index on
 * {mentorId, date, startTime, endTime} (no lockedBy) to make the claim a single atomic
 * DB operation — if another mentee already holds this exact slot, MongoDB itself rejects
 * the insert with a duplicate-key error (code 11000) rather than the app deciding via a
 * separate read first. Callers must catch that error and treat it as "slot already held".
 * * @function createLock
 * @param {Object} payloadFields
 * @param {string} payloadFields.mentorId
 * @param {string} payloadFields.date
 * @param {string} payloadFields.startTime
 * @param {string} payloadFields.endTime
 * @param {any} payloadFields.menteeId
 * @param {Date} payloadFields.expiresAt
 * @returns {Promise<Object>} The newly created lock document.
 * @throws {Error} MongoServerError with code 11000 if the slot is already locked by someone else.
 */
const createLock = ({ mentorId, date, startTime, endTime, menteeId, expiresAt }) =>
    SlotLock.create({ mentorId, date, startTime, endTime, lockedBy: menteeId, expiresAt });

/**
 * Direct matching execution query looking up and deleting individual transient lock segments.
 * * @function deleteLock
 * @param {Object} parameters - Dynamic removal components specifications container.
 * @param {string} parameters.mentorId - Target channel selector check key indicator.
 * @param {string} parameters.date - Target calendar day selector string parameters.
 * @param {string} parameters.startTime - Opening timeline target window indicator.
 * @param {string} parameters.endTime - Terminating timeline target window indicator.
 * @param {any} parameters.menteeId - Security context identifier pointer checking recipient indices.
 * @returns {Promise<Object|null>} Removed database entity information summary confirmation details.
 */
const deleteLock = ({ mentorId, date, startTime, endTime, menteeId }) =>
    SlotLock.findOneAndDelete({
        mentorId,
        date,
        startTime,
        endTime,
        lockedBy: menteeId,
    });

/**
 * Hard discards progress node structures using multi-property filter criteria parameters blocks.
 * * @function deleteManyLocks
 * @param {Object} filter - Mongoose update delete criteria statement matching targeted indices variables.
 * @returns {Promise<Object>} MongoDB mass removal summary tracking rows altered counts metrics.
 */
const deleteManyLocks = (filter) => SlotLock.deleteMany(filter);

/**
 * Filters out public items, returning active competitor locks owned by third-party requestor users.
 * * @function findActiveLocksExcludingUser
 * @param {string} mentorId - Targeted parent channel selection criteria search identifier.
 * @param {any} userId - Reference checking index parameters ensuring creator indices are omitted.
 * @returns {Promise<Object[]>} Collection array listing competitor holding segments lean data node dictionaries.
 */
const findActiveLocksExcludingUser = (mentorId, userId) =>
    SlotLock.find({
        mentorId,
        lockedBy: { $ne: userId },
    }).lean();

module.exports = {
    findConfirmedBookings,
    findActiveLocks,
    refreshOwnLock,
    createLock,
    deleteLock,
    deleteManyLocks,
    findActiveLocksExcludingUser,
};