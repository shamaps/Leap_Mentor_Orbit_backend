// utils/mappers/availability.mapper.js
const { PLATFORM_TIMEZONE } = require("../../config/constants");

const toAvailabilityDTO = (doc, mentorId) => {
    if (!doc) {
        return {
            mentor: mentorId,
            timezone: PLATFORM_TIMEZONE,
            sessionDurations: [30, 60],
            googleCalendarConnected: false,
            specificDates: [],
            isNew: true,
        };
    }
    return {
        mentor: doc.mentor,
        timezone: doc.timezone,
        sessionDurations: doc.sessionDurations,
        googleCalendarConnected: doc.googleCalendarConnected || false,
        specificDates: doc.specificDates || [],
    };
};

const toPublicAvailabilityDTO = (doc) => ({
    timezone: doc.timezone,
    sessionDurations: doc.sessionDurations,
    specificDates: doc.specificDates,
});

const toAvailableSlotsDTO = (data) => ({
    timezone: data.timezone,
    sessionDurations: data.sessionDurations,
    slots: data.slots,
});

module.exports = { toAvailabilityDTO, toPublicAvailabilityDTO, toAvailableSlotsDTO };