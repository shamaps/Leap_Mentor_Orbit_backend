// services/availability.service.js
const { generateSlotsFromSpecificDates } = require("../utils/generateSlots");
const { PLATFORM_TIMEZONE } = require("../config/constants");
const AppError = require("../utils/appError");
const createAvailabilityService = (availabilityRepository, { logger }) => {
const getMyAvailability = async (mentorId) => {
  const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);

  if (!availability) {
    return {
      mentor:                  mentorId,
      timezone:                PLATFORM_TIMEZONE,
      sessionDurations:        [30, 60],
      googleCalendarConnected: false,
      specificDates:           [],
      isNew:                   true,
    };
  }

  return availability;
};

const createAvailability = async (mentorId, body) => {
  const existing = await availabilityRepository.findAvailabilityByMentor(mentorId);
  if (existing) {
    throw new AppError(409, "Availability already exists. Use PATCH /api/availability/me to update");
  }

  const { timezone, sessionDurations, specificDates } = body;
  return await availabilityRepository.createAvailability({
    mentorId,
    timezone,
    sessionDurations,
    specificDates,
  });
};

const updateAvailability = async (mentorId, body) => {
  const allowedFields = [
    "timezone",
    "sessionDurations",
    "specificDates",
    "googleCalendarConnected",
  ];

  const updates = {};
  allowedFields.forEach((field) => {
    if (body[field] !== undefined) {
      updates[field] = body[field];
    }
  });

  if (Object.keys(updates).length === 0) {
    throw new AppError(400, "No valid fields provided to update");
  }

  return await availabilityRepository.updateAvailability(mentorId, updates);
};

const getMentorAvailability = async (mentorId) => {
  const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);

  if (!availability) {
    throw new AppError(404, "Availability not set by this mentor");
  }

  return {
    timezone:         availability.timezone,
    sessionDurations: availability.sessionDurations,
    specificDates:    availability.specificDates,
  };
};

const deleteAvailability = async (mentorId) => {
  await availabilityRepository.deleteAvailability(mentorId);
};

const getAvailableSlots = async (mentorId, duration, userId) => {
  if (![30, 45, 60].includes(duration)) {
    throw new AppError(400, "Duration must be 30, 45, or 60 minutes");
  }

  const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);
  if (!availability) {
    throw new AppError(404, "Availability not set by this mentor");
  }

  // Build booked slots
  const bookedRequests = await availabilityRepository.findBookedRequests(mentorId);
  const bookedSlots = bookedRequests.flatMap((r) => {
    const slots = r.selectedSlots || (r.selectedSlot ? [r.selectedSlot] : []);
    return slots.map((slot) => ({
      date:      slot.date,
      startTime: slot.startTime,
      endTime:   slot.endTime,
    }));
  });

  // Build locked slots
  const activeLocks = await availabilityRepository.findActiveLocks(mentorId, userId);
  const lockedSlots = activeLocks.map((l) => ({
    date:      l.date,
    startTime: l.startTime,
    endTime:   l.endTime,
  }));

  const allBlockedSlots = [...bookedSlots, ...lockedSlots];

  if (!availability.specificDates?.length) {
    return {
      timezone:         availability.timezone,
      sessionDurations: availability.sessionDurations,
      slots:            [],
    };
  }

  const grouped = generateSlotsFromSpecificDates(
    availability.specificDates,
    duration,
    allBlockedSlots
  );

  return {
    timezone:         availability.timezone,
    sessionDurations: availability.sessionDurations,
    slots:            grouped,
  };
};

  return { getMyAvailability, createAvailability, updateAvailability, getMentorAvailability, deleteAvailability, getAvailableSlots };
};
module.exports = createAvailabilityService;