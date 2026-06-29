// services/availability.service.js
const { generateSlotsFromSpecificDates } = require("../utils/generateSlots");
const { PLATFORM_TIMEZONE } = require("../config/constants");
const { toAvailabilityDTO, toPublicAvailabilityDTO, toAvailableSlotsDTO } = require("../utils/mappers/availability.mapper");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} TimeSlot
 * @property {string} startTime - The slot start time formatted as "HH:MM".
 * @property {string} endTime - The slot end time formatted as "HH:MM".
 */

/**
 * @typedef {Object} SpecificDateConfig
 * @property {string} date - Calendar date formatted as "YYYY-MM-DD".
 * @property {TimeSlot[]} slots - Collection of scheduled active operating periods.
 */

/**
 * @typedef {Object} AvailabilityRepository
 * @property {(mentorId: string) => Promise<Object|null>} findAvailabilityByMentor
 * @property {(data: Object) => Promise<Object>} createAvailability
 * @property {(mentorId: string, updates: Object) => Promise<Object>} updateAvailability
 * @property {(mentorId: string) => Promise<Object|null>} deleteAvailability
 * @property {(mentorId: string) => Promise<Object[]>} findBookedRequests
 * @property {(mentorId: string, userId: string) => Promise<Object[]>} findActiveLocks
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function to construct the Availability Service layer.
 * * @param {AvailabilityRepository} availabilityRepository - The persistence data abstraction layer instance.
 * @param {{ logger: Logger }} dependencies - Application core logging infrastructure.
 * @returns {Object} Configured object map containing operational service methodologies.
 */
const createAvailabilityService = (availabilityRepository, { logger }) => {

  /**
   * Retrieves the current requestor's specialized availability dashboard metadata payload mapping.
   * * @async
   * @function getMyAvailability
   * @param {string} mentorId - The target authenticated professional's unique key identifier.
   * @returns {Promise<Object>} Formatted Data Transfer Object mapping out target configuration.
   */
  const getMyAvailability = async (mentorId) => {
    const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);

    if (!availability) {
      return toAvailabilityDTO(null, mentorId);
    }
    return toAvailabilityDTO(availability);
  };

  /**
   * Provisions a fresh availability record profile for a newly configuring mentor user.
   * * @async
   * @function createAvailability
   * @param {string} mentorId - The target authenticated owner key.
   * @param {Object} body - Request metadata payload content data.
   * @param {string} body.timezone - Reference operational geographic timezone code context.
   * @param {number[]} body.sessionDurations - Permitted duration spans allowed for sessions.
   * @param {SpecificDateConfig[]} body.specificDates - Array map collections configuring exact dates and times.
   * @throws {AppError} 409 - If an availability database entity structure is already present.
   * @returns {Promise<Object>} Resolution detailing freshly saved schema document layout.
   */
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

  /**
   * Strategically isolates changes and alters the existing availability record fields.
   * * @async
   * @function updateAvailability
   * @param {string} mentorId - The target operational owner key.
   * @param {Object} body - Delta fields container checking against filter parameters.
   * @throws {AppError} 400 - If no allowed parameter is populated inside the body payload.
   * @returns {Promise<Object>} Document confirmation returning structural state.
   */
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

  /**
   * Public-facing lookup providing sanitization constraints over vulnerable mentor metadata.
   * * @async
   * @function getMentorAvailability
   * @param {string} mentorId - Targeted search key reference.
   * @throws {AppError} 404 - If targeted entity profile is not resolved within the base layers.
   * @returns {Promise<Object>} Sanitized public layout availability context mapping.
   */
  const getMentorAvailability = async (mentorId) => {
    const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);

    if (!availability) {
      throw new AppError(404, "Availability not set by this mentor");
    }

    return toPublicAvailabilityDTO(availability);
  };

  /**
   * Destroys configuration entity layout structures recorded under target key reference.
   * * @async
   * @function deleteAvailability
   * @param {string} mentorId - Performing session user identifier.
   * @returns {Promise<void>} Resolves upon successful eviction execution.
   */
  const deleteAvailability = async (mentorId) => {
    await availabilityRepository.deleteAvailability(mentorId);
  };

  /**
   * Calculates dynamic open time slots matrix after processing concurrently active locks and approved active schedules.
   * * @async
   * @function getAvailableSlots
   * @param {string} mentorId - Selected calendar destination target index identifier.
   * @param {number} duration - Requested meeting time duration validation metric (Must equal 30, 45, or 60).
   * @param {string} userId - Requesting end consumer user key checking active reservation locks.
   * @throws {AppError} 400 - If meeting window context requested violates preset static bounds.
   * @throws {AppError} 404 - If mentor database settings are missing.
   * @returns {Promise<Object>} Generated schema detailing open appointment opportunities grouped cleanly.
   */
  const getAvailableSlots = async (mentorId, duration, userId) => {
    if (![30, 45, 60].includes(duration)) {
      throw new AppError(400, "Duration must be 30, 45, or 60 minutes");
    }

    const availability = await availabilityRepository.findAvailabilityByMentor(mentorId);
    if (!availability) {
      throw new AppError(404, "Availability not set by this mentor");
    }

    const bookedRequests = await availabilityRepository.findBookedRequests(mentorId);
    const bookedSlots = bookedRequests.flatMap((r) => {
      const slots = r.selectedSlots || (r.selectedSlot ? [r.selectedSlot] : []);
      return slots.map((slot) => ({
        date: slot.date,
        startTime: slot.startTime,
        endTime: slot.endTime,
      }));
    });

    const activeLocks = await availabilityRepository.findActiveLocks(mentorId, userId);
    const lockedSlots = activeLocks.map((l) => ({
      date: l.date,
      startTime: l.startTime,
      endTime: l.endTime,
    }));

    const allBlockedSlots = [...bookedSlots, ...lockedSlots];

    if (!availability.specificDates?.length) {
      return {
        timezone: availability.timezone,
        sessionDurations: availability.sessionDurations,
        slots: [],
      };
    }

    const grouped = generateSlotsFromSpecificDates(
      availability.specificDates,
      duration,
      allBlockedSlots
    );

    return toAvailableSlotsDTO({ timezone: availability.timezone, sessionDurations: availability.sessionDurations, slots: grouped });
  };

  return { getMyAvailability, createAvailability, updateAvailability, getMentorAvailability, deleteAvailability, getAvailableSlots };
};

module.exports = createAvailabilityService;