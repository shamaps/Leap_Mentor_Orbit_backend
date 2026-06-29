// repositories/googleCalendar.repository.js
const Availability = require("../models/Availability");
const { encrypt, decrypt } = require("../utils/tokenCrypto");

/**
 * Resolves availability records, crypto-decrypting credential hashes if located inside data pools.
 * * @function findAvailabilityWithToken
 * @param {any} mentorId - Target primary key tracking internal account user entries.
 * @returns {Promise<Object|null>} Hydrated document pointer context layout mapping attributes or null.
 */
const findAvailabilityWithToken = async (mentorId) => {
    const doc = await Availability.findOne({ mentor: mentorId }).select("+googleCalendarToken");
    if (doc?.googleCalendarToken) {
        doc.googleCalendarToken = decrypt(doc.googleCalendarToken);
    }
    return doc;
};

/**
 * Commits token variable blocks under a dynamic crypto-encryption wrapper, mapping activation status parameters.
 * * @function saveCalendarToken
 * @param {any} mentorId - Target primary user unique locator tracking entries.
 * @param {string} tokenJson - Serialized access credentials map parameter string.
 * @returns {Promise<Object>} Persisted document confirmation verification data.
 */
const saveCalendarToken = async (mentorId, tokenJson) => {
    return await Availability.findOneAndUpdate(
        { mentor: mentorId },
        { googleCalendarConnected: true, googleCalendarToken: encrypt(tokenJson) },
        { upsert: true, new: true }
    );
};

/**
 * Swaps outstanding encryption strings without altering visibility markers.
 * * @function updateCalendarToken
 * @param {any} mentorId - Target reference locator key.
 * @param {string} tokenJson - Serialized updated token properties configuration.
 * @returns {Promise<Object>} Updated database record template confirmation parameters.
 */
const updateCalendarToken = async (mentorId, tokenJson) => {
    return await Availability.findOneAndUpdate(
        { mentor: mentorId },
        { googleCalendarToken: encrypt(tokenJson) }
    );
};

/**
 * Drops active synchronization markers, scrubbing authorization hashes out of targeted profiles.
 * * @function disconnectCalendar
 * @param {any} mentorId - Operational target primary selection criteria parameter.
 * @returns {Promise<Object>} Operational execution database response metrics.
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