// repositories/googleCalendar.repository.js
const Availability = require("../models/Availability");

/**
 * Find availability record for a mentor, including the calendar token.
 * @param {ObjectId} mentorId
 * @returns {Promise<Document|null>}
 */
const findAvailabilityWithToken = async (mentorId) => {
    return await Availability.findOne({ mentor: mentorId }).select("+googleCalendarToken");
};

/**
 * Save Google Calendar tokens to a mentor's availability record.
 * Creates the record if it doesn't exist (upsert).
 * @param {ObjectId} mentorId
 * @param {string}   tokenJson - JSON.stringify(tokens)
 * @returns {Promise<Document>}
 */
const saveCalendarToken = async (mentorId, tokenJson) => {
    return await Availability.findOneAndUpdate(
        { mentor: mentorId },
        { googleCalendarConnected: true, googleCalendarToken: tokenJson },
        { upsert: true, new: true }
    );
};

/**
 * Update only the token (used during auto-refresh).
 * @param {ObjectId} mentorId
 * @param {string}   tokenJson
 * @returns {Promise<Document>}
 */
const updateCalendarToken = async (mentorId, tokenJson) => {
    return await Availability.findOneAndUpdate(
        { mentor: mentorId },
        { googleCalendarToken: tokenJson }
    );
};

/**
 * Disconnect Google Calendar for a mentor.
 * @param {ObjectId} mentorId
 * @returns {Promise<Document>}
 */
const disconnectCalendar = async (mentorId) => {
    return await Availability.findOneAndUpdate(
        { mentor: mentorId },
        { googleCalendarConnected: false, googleCalendarToken: "" }
    );
};

module.exports = {
    findAvailabilityWithToken,
    saveCalendarToken,
    updateCalendarToken,
    disconnectCalendar,
};