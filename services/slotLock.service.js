const repo = require("../repositories/slotLock.repository");

const LOCK_DURATION_MINUTES = 10;

// ── Helpers ───────────────────────────────────────────────────
const timeToMinutes = (time) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

const hasOverlap = (aStart, aEnd, bStart, bEnd) =>
    aStart < bEnd && aEnd > bStart;

// ─────────────────────────────────────────────────────────────

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
    await repo.upsertLock(mentorId, date, startTime, endTime, menteeId, expiresAt);

    return {
        status: 200,
        body: { message: "Slot locked successfully", expiresAt, lockedFor: LOCK_DURATION_MINUTES },
    };
};

const unlockSlot = async ({ mentorId, date, startTime, endTime, menteeId }) => {
    if (!mentorId || !date || !startTime || !endTime) {
        return { status: 400, body: { message: "Missing required fields" } };
    }

    await repo.deleteLock(mentorId, date, startTime, endTime, menteeId);

    return { status: 200, body: { message: "Slot unlocked successfully" } };
};

const unlockAllByMentee = async ({ mentorId, menteeId }) => {
    const filter = { lockedBy: menteeId };
    if (mentorId) filter.mentorId = mentorId;

    await repo.deleteManyLocks(filter);

    return { status: 200, body: { message: "All locks released successfully" } };
};

const getActiveLocks = async ({ mentorId, userId }) => {
    const locks = await repo.findActiveLocksExcludingUser(mentorId, userId);
    return { status: 200, body: { locks } };
};

module.exports = {
    lockSlot,
    unlockSlot,
    unlockAllByMentee,
    getActiveLocks,
};