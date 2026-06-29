// services/slotLock.service.js
const LOCK_DURATION_MINUTES = 10;

/**
 * @typedef {Object} TargetTimeSlot
 * @property {string} date - Calendar date formatted as "YYYY-MM-DD".
 * @property {string} startTime - Bounding opening hour formatted as "HH:MM".
 * @property {string} endTime - Bounding closing hour formatted as "HH:MM".
 */

/**
 * @typedef {Object} SlotLockRepository
 * @property {(mentorId: string) => Promise<Object[]>} findConfirmedBookings - Resolves active or pending connection requests blocking dynamic timelines.
 * @property {(mentorId: string, date: string) => Promise<Object[]>} findActiveLocks - Pulls active transient holdings matching target dates.
 * @property {(data: Object) => Promise<Object>} upsertLock - Registers or extends individual user scheduling holds.
 * @property {(data: Object) => Promise<Object|null>} deleteLock - Discards an individual explicit hold matching parameters.
 * @property {(filter: Object) => Promise<Object>} deleteManyLocks - Performs mass purges of lock documents from clusters.
 * @property {(mentorId: string, userId: any) => Promise<Object[]>} findActiveLocksExcludingUser - Selects concurrent holds owned by separate callers.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs routine pipeline milestones.
 * @property {(message: string, error: any) => void} error - Traces processing failure streams.
 */

/**
 * Factory function constructing the scheduling orchestration logic for temporal slot holds.
 * * @param {SlotLockRepository} repo - The persistence layer data registry wrapper instance.
 * @param {{ logger: Logger }} dependencies - Application core telemetry tracing tools injection.
 * @returns {Object} Configured service interface containing slot-locking workflows methods.
 */
const createSlotLockService = (repo, { logger }) => {
    // Helpers

    /**
     * Converts timestamp strings into discrete minutes integer counts relative to midnight.
     * * @private
     * @function timeToMinutes
     * @param {string} time - Clock timestamp formatted as "HH:MM".
     * @returns {number} Evaluated time translated into total minutes integer.
     */
    const timeToMinutes = (time) => {
        const [h, m] = time.split(":").map(Number);
        return h * 60 + m;
    };

    /**
     * Evaluates overlapping bounds between two independent operational time vectors.
     * * @private
     * @function hasOverlap
     * @param {number} aStart - Boundary opening minutes count for vector A.
     * @param {number} aEnd - Boundary closing minutes count for vector A.
     * @param {number} bStart - Boundary opening minutes count for vector B.
     * @param {number} bEnd - Boundary closing minutes count for vector B.
     * @returns {boolean} True if timeline boundaries intersect.
     */
    const hasOverlap = (aStart, aEnd, bStart, bEnd) =>
        aStart < bEnd && aEnd > bStart;

    /**
     * Asserts timeline integrity against confirmed bookings and competing active constraints, registering transient holds.
     * * @async
     * @function lockSlot
     * @param {Object} parameters - Intake processing parameters container payload.
     * @param {string} parameters.mentorId - Target destination provider user index.
     * @param {string} parameters.date - Calendar target date string formatted as "YYYY-MM-DD".
     * @param {string} parameters.startTime - Bounding opening hour formatted as "HH:MM".
     * @param {string} parameters.endTime - Bounding closing hour formatted as "HH:MM".
     * @param {any} parameters.menteeId - Security verify validation identifier token checking ownership.
     * @returns {Promise<{ status: number, body: Object }>} Processing descriptor outcome summary envelope.
     */
    const lockSlot = async ({ mentorId, date, startTime, endTime, menteeId }) => {
        if (!mentorId || !date || !startTime || !endTime) {
            return { status: 400, body: { message: "Missing required fields" } };
        }

        const sStart = timeToMinutes(startTime);
        const sEnd = timeToMinutes(endTime);

        // ── 1. Check confirmed bookings for overlap ──
        const confirmedBookings = await repo.findConfirmedBookings(mentorId);

        const bookedSlots = confirmedBookings.flatMap((r) => {
            const slots = r.selectedSlots || (r.selectedSlot ? [r.selectedSlot] : []);
            return slots.map((s) => ({
                date: s.date,
                startTime: s.startTime,
                endTime: s.endTime,
            }));
        });

        const isConfirmedBooked = bookedSlots.some((b) => {
            if (b.date !== date) return false;
            return hasOverlap(sStart, sEnd, timeToMinutes(b.startTime), timeToMinutes(b.endTime));
        });

        if (isConfirmedBooked) {
            return { status: 409, body: { message: "This slot is already booked", code: "SLOT_BOOKED" } };
        }

        // ── 2. Check active locks for overlap ──
        const activeLocks = await repo.findActiveLocks(mentorId, date);

        const isLocked = activeLocks.some((lock) => {
            // Allow mentee to re-lock their own slot (refresh timer)
            if (lock.lockedBy.toString() === menteeId.toString()) return false;
            return hasOverlap(sStart, sEnd, timeToMinutes(lock.startTime), timeToMinutes(lock.endTime));
        });

        if (isLocked) {
            return {
                status: 409,
                body: { message: "This slot is temporarily held by another user", code: "SLOT_LOCKED" },
            };
        }

        // ── 3. Upsert lock — refreshes timer if same mentee re-selects ──
        const expiresAt = new Date(Date.now() + LOCK_DURATION_MINUTES * 60 * 1000);
        await repo.upsertLock({ mentorId, date, startTime, endTime, menteeId, expiresAt });

        return {
            status: 200,
            body: { message: "Slot locked successfully", expiresAt, lockedFor: LOCK_DURATION_MINUTES },
        };
    };

    /**
     * Manually evicts an individual explicit transient lock, freeing up the timeline parameters bounds.
     * * @async
     * @function unlockSlot
     * @param {Object} contextParameters - Intake identification values mapping coordinates.
     * @param {string} contextParameters.mentorId - Associated primary mentor unique locator checking records.
     * @param {string} contextParameters.date - Calendar date string formatted as "YYYY-MM-DD".
     * @param {string} contextParameters.startTime - Bounding opening hour tracking index.
     * @param {string} contextParameters.endTime - Bounding closing hour tracking index.
     * @param {any} contextParameters.menteeId - Security verify identification criteria reference.
     * @returns {Promise<{ status: number, body: Object }>} Dispatched confirmation results envelope payload.
     */
    const unlockSlot = async ({ mentorId, date, startTime, endTime, menteeId }) => {
        if (!mentorId || !date || !startTime || !endTime) {
            return { status: 400, body: { message: "Missing required fields" } };
        }

        await repo.deleteLock({ mentorId, date, startTime, endTime, menteeId });

        return { status: 200, body: { message: "Slot unlocked successfully" } };
    };

    /**
     * Executes mass purges clearing out all unexpired active locks associated with a single mentee requestor.
     * * @async
     * @function unlockAllByMentee
     * @param {Object} purgeContext - Operational data map packaging lookup parameters filters.
     * @param {string} [purgeContext.mentorId] - Optional constraint restricting purges to a single provider channel.
     * @param {any} purgeContext.menteeId - Account indicator index locator checking lock ownership.
     * @returns {Promise<{ status: number, body: Object }>} Mass purge action results metrics.
     */
    const unlockAllByMentee = async ({ mentorId, menteeId }) => {
        const filter = { lockedBy: menteeId };
        if (mentorId) filter.mentorId = mentorId;

        await repo.deleteManyLocks(filter);

        return { status: 200, body: { message: "All locks released successfully" } };
    };

    /**
     * Resolves concurrent transient holdings configured by separate consumers, omitting the caller's own slots.
     * * @async
     * @function getActiveLocks
     * @param {Object} queryOptions - Dynamic path search parameter indices.
     * @param {string} queryOptions.mentorId - Dynamic parameter checking host channels identifier.
     * @param {any} queryOptions.userId - Security verification token signature verifying credentials.
     * @returns {Promise<{ status: number, body: { locks: Object[] } }>} Grouped list detailing opposing holding items profiles.
     */
    const getActiveLocks = async ({ mentorId, userId }) => {
        const locks = await repo.findActiveLocksExcludingUser(mentorId, userId);
        return { status: 200, body: { locks } };
    };

    return { lockSlot, unlockSlot, unlockAllByMentee, getActiveLocks };
};

module.exports = createSlotLockService;