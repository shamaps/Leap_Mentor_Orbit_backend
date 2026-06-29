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
 * Performs atomic operationsupsert updates refreshing temporal lock durations or registering fresh elements.
 * * @function upsertLock
 * @param {Object} payloadFields - Intake data schema options container.
 * @param {string} payloadFields.mentorId - Target unique provider profile index key string.
 * @param {string} payloadFields.date - Target date string context parameters.
 * @param {string} payloadFields.startTime - Clock format opening bounding parameter.
 * @param {string} payloadFields.endTime - Clock format terminal bounding parameter.
 * @param {any} payloadFields.menteeId - Security verify criteria validating lock ownership attributes.
 * @param {Date} payloadFields.expiresAt - Transient expiration limit timestamp indicator.
 * @returns {Promise<Object>} Newly generated or extended Mongoose tracking lock document record.
 */
const upsertLock = ({ mentorId, date, startTime, endTime, menteeId, expiresAt }) =>
    SlotLock.findOneAndUpdate(
        { mentorId, date, startTime, endTime, lockedBy: menteeId },
        { expiresAt },
        { upsert: true, new: true }
    );

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
    upsertLock,
    deleteLock,
    deleteManyLocks,
    findActiveLocksExcludingUser,
};