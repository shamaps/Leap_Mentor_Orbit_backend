// services/engagement-service/test/sessionOperations.service.test.js
const createSessionOperationsService = require("../src/services/sessionOperations.service");

const ID = (n) => String(n).repeat(24).slice(0, 24);
const REQ = ID(1), MENTOR = ID(2), MENTEE = ID(3), STRANGER = ID(4);

const slot = (over = {}) => ({
    date: "2026-11-01", startTime: "10:00", endTime: "11:00", day: "Sunday",
    status: "booked", menteeMarked: false, mentorMarked: false, completedAt: null, ...over,
});

// Minimal in-memory stand-in for session.repository
const makeRepo = (session) => {
    const calls = [];
    const repo = {
        calls,
        findSession: async () => session,
        findSessionDocument: async () => session && Object.assign(session, { markModified() { } }),
        saveSession: async (s) => { calls.push(["saveSession"]); return s; },
        markParticipantComplete: async ({ slotIndex, participant }) => {
            calls.push(["markParticipantComplete", slotIndex, participant]);
            const s = session.selectedSlots[slotIndex];
            if (s.status === "cancelled") return false;
            s[participant === "mentor" ? "mentorMarked" : "menteeMarked"] = true;
            return true;
        },
        markCompletedAtIfMissing: async (_id, slotIndex, at) => {
            calls.push(["markCompletedAtIfMissing", slotIndex]);
            session.selectedSlots[slotIndex].completedAt ||= at;
        },
        confirmBooking: async ({ confirmedSlot }) => {
            calls.push(["confirmBooking"]);
            if (!session || session.status !== "pending") return null;
            session.confirmedSlot = confirmedSlot;
            return session;
        },
        applyReschedule: async ({ slotIndex, newSlot }) => {
            calls.push(["applyReschedule", slotIndex]);
            if (session.status !== "ongoing" || session.selectedSlots[slotIndex].status === "cancelled") return null;
            Object.assign(session.selectedSlots[slotIndex], { status: "cancelled", isRescheduled: true });
            session.selectedSlots.push(newSlot);
            return session;
        },
    };
    return repo;
};

const baseSession = (over = {}) => ({
    _id: REQ, mentor: MENTOR, mentee: MENTEE, status: "ongoing",
    selectedSlots: [slot()], ...over,
});

// ── confirmSlot ───────────────────────────────────────────────────────────
test("confirmSlot: marks the mentee and reports bothMarked=false until the mentor confirms", async () => {
    const session = baseSession();
    const ops = createSessionOperationsService(makeRepo(session));
    const r = await ops.confirmSlot({ requestId: REQ, slotIndex: 0, userId: MENTEE });
    expect(r.participant).toBe("mentee");
    expect(r.bothMarked).toBe(false);
    expect(session.selectedSlots[0].menteeMarked).toBe(true);
});

test("confirmSlot: sets completedAt once both sides have confirmed", async () => {
    const session = baseSession({ selectedSlots: [slot({ menteeMarked: true })] });
    const repo = makeRepo(session);
    const ops = createSessionOperationsService(repo);
    const r = await ops.confirmSlot({ requestId: REQ, slotIndex: 0, userId: MENTOR });
    expect(r.bothMarked).toBe(true);
    expect(repo.calls.some(([name]) => name === "markCompletedAtIfMissing")).toBe(true);
    expect(session.selectedSlots[0].completedAt).toBeTruthy();
});

test("confirmSlot: rejects non-participants, bad ids, cancelled slots and bad indexes", async () => {
    const ops = createSessionOperationsService(makeRepo(baseSession({ selectedSlots: [slot({ status: "cancelled" })] })));
    await expect(ops.confirmSlot({ requestId: "nope", slotIndex: 0, userId: MENTEE })).rejects.toHaveProperty("status", 400);
    await expect(ops.confirmSlot({ requestId: REQ, slotIndex: -1, userId: MENTEE })).rejects.toHaveProperty("status", 400);
    await expect(ops.confirmSlot({ requestId: REQ, slotIndex: 0, userId: STRANGER })).rejects.toHaveProperty("status", 403);
    await expect(ops.confirmSlot({ requestId: REQ, slotIndex: 0, userId: MENTEE })).rejects.toHaveProperty("status", 409);
    await expect(ops.confirmSlot({ requestId: REQ, slotIndex: 5, userId: MENTEE })).rejects.toHaveProperty("status", 404);
});

test("confirmSlot: returns 404 when the session does not exist", async () => {
    const ops = createSessionOperationsService(makeRepo(null));
    await expect(ops.confirmSlot({ requestId: REQ, slotIndex: 0, userId: MENTEE })).rejects.toHaveProperty("status", 404);
});

test("confirmSlot: a retry on a completed session is idempotent and does not write again", async () => {
    const session = baseSession({ status: "completed", selectedSlots: [slot({ menteeMarked: true, mentorMarked: true })] });
    const repo = makeRepo(session);
    const ops = createSessionOperationsService(repo);
    const r = await ops.confirmSlot({ requestId: REQ, slotIndex: 0, userId: MENTEE });
    expect(r.bothMarked).toBe(true);
    expect(repo.calls.length).toBe(0);
});

// ── releaseSessionSlot ────────────────────────────────────────────────────
test("releaseSessionSlot: cancels the slot and saves once", async () => {
    const session = baseSession();
    const repo = makeRepo(session);
    const ops = createSessionOperationsService(repo);
    const r = await ops.releaseSessionSlot({ requestId: REQ, slotIndex: 0, cancelledBy: "mentee", reason: "  busy  " });
    expect(r.slot.status).toBe("cancelled");
    expect(r.slot.cancelledBy).toBe("mentee");
    expect(r.slot.cancellationReason).toBe("busy");
    expect(repo.calls.filter(([n]) => n === "saveSession").length).toBe(1);
});

test("releaseSessionSlot: repeating the call is a no-op (retry safe)", async () => {
    const session = baseSession();
    const repo = makeRepo(session);
    const ops = createSessionOperationsService(repo);
    await ops.releaseSessionSlot({ requestId: REQ, slotIndex: 0, cancelledBy: "mentor" });
    await ops.releaseSessionSlot({ requestId: REQ, slotIndex: 0, cancelledBy: "mentor" });
    expect(repo.calls.filter(([n]) => n === "saveSession").length).toBe(1);
});

test("releaseSessionSlot: refuses completed slots and non-ongoing sessions; validates input", async () => {
    const done = createSessionOperationsService(makeRepo(baseSession({ selectedSlots: [slot({ menteeMarked: true, mentorMarked: true })] })));
    await expect(done.releaseSessionSlot({ requestId: REQ, slotIndex: 0, cancelledBy: "mentor" })).rejects.toHaveProperty("status", 409);
    const closed = createSessionOperationsService(makeRepo(baseSession({ status: "completed" })));
    await expect(closed.releaseSessionSlot({ requestId: REQ, slotIndex: 0, cancelledBy: "mentor" })).rejects.toHaveProperty("status", 409);
    await expect(closed.releaseSessionSlot({ requestId: REQ, slotIndex: 0, cancelledBy: "admin" })).rejects.toHaveProperty("status", 400);
});

test("releaseSessionSlot: result is plain JSON (safe for ServiceCompensation.result)", async () => {
    const ops = createSessionOperationsService(makeRepo(baseSession()));
    const r = await ops.releaseSessionSlot({ requestId: REQ, slotIndex: 0, cancelledBy: "mentee" });
    expect(r).toStrictEqual(JSON.parse(JSON.stringify(r)));
    expect(typeof r.slot.cancelledAt).toBe("string");
});

// ── confirmBookingSlot ────────────────────────────────────────────────────
const CONFIRMED = { day: "Sunday", date: "2026-11-01", startTime: "10:00", endTime: "11:00" };

test("confirmBookingSlot: confirms a pending request", async () => {
    const ops = createSessionOperationsService(makeRepo(baseSession({ status: "pending" })));
    const r = await ops.confirmBookingSlot({ requestId: REQ, mentorId: MENTOR, confirmedSlot: CONFIRMED });
    expect(r.confirmedSlot).toEqual(CONFIRMED);
});

test("confirmBookingSlot: replaying an already-accepted identical slot succeeds", async () => {
    const session = baseSession({ status: "accepted", confirmedSlot: CONFIRMED });
    const ops = createSessionOperationsService(makeRepo(session));
    const r = await ops.confirmBookingSlot({ requestId: REQ, mentorId: MENTOR, confirmedSlot: CONFIRMED });
    expect(r.confirmedSlot).toEqual(CONFIRMED);
});

test("confirmBookingSlot: wrong mentor is 403, different slot after acceptance is 409, missing is 404", async () => {
    const accepted = baseSession({ status: "accepted", confirmedSlot: CONFIRMED });
    const ops = createSessionOperationsService(makeRepo(accepted));
    await expect(ops.confirmBookingSlot({ requestId: REQ, mentorId: STRANGER, confirmedSlot: CONFIRMED })).rejects.toHaveProperty("status", 403);
    await expect(ops.confirmBookingSlot({ requestId: REQ, mentorId: MENTOR, confirmedSlot: { ...CONFIRMED, startTime: "12:00" } })).rejects.toHaveProperty("status", 409);
    const none = createSessionOperationsService(makeRepo(null));
    await expect(none.confirmBookingSlot({ requestId: REQ, mentorId: MENTOR, confirmedSlot: CONFIRMED })).rejects.toHaveProperty("status", 404);
    await expect(ops.confirmBookingSlot({ requestId: REQ, mentorId: MENTOR, confirmedSlot: { date: "2026-11-01" } })).rejects.toHaveProperty("status", 400);
});

// ── rescheduleSessionSlot ─────────────────────────────────────────────────
const NEW = { requestId: REQ, slotIndex: 0, userId: MENTEE, date: "2026-11-02", startTime: "14:00", endTime: "15:00", day: "Monday" };

test("rescheduleSessionSlot: cancels the old slot and appends the new one", async () => {
    const session = baseSession();
    const ops = createSessionOperationsService(makeRepo(session));
    const r = await ops.rescheduleSessionSlot(NEW);
    expect(r.oldSlotIndex).toBe(0);
    expect(r.newSlotIndex).toBe(1);
    expect(r.oldSlot.status).toBe("cancelled");
    expect(r.newSlot.rescheduledFromIndex).toBe(0);
});

test("rescheduleSessionSlot: replay after success returns the same result without a second write", async () => {
    const session = baseSession();
    const repo = makeRepo(session);
    const ops = createSessionOperationsService(repo);
    const first = await ops.rescheduleSessionSlot(NEW);
    const second = await ops.rescheduleSessionSlot(NEW);
    expect(second.newSlotIndex).toBe(first.newSlotIndex);
    expect(repo.calls.filter(([n]) => n === "applyReschedule").length).toBe(1);
    expect(session.selectedSlots.length).toBe(2);
});

test("rescheduleSessionSlot: validation and permission errors", async () => {
    const ops = createSessionOperationsService(makeRepo(baseSession()));
    await expect(ops.rescheduleSessionSlot({ ...NEW, date: "" })).rejects.toHaveProperty("status", 400);
    await expect(ops.rescheduleSessionSlot({ ...NEW, userId: STRANGER })).rejects.toHaveProperty("status", 403);
    await expect(ops.rescheduleSessionSlot({ ...NEW, slotIndex: 9 })).rejects.toHaveProperty("status", 404);
    const completed = createSessionOperationsService(makeRepo(baseSession({ selectedSlots: [slot({ menteeMarked: true, mentorMarked: true })] })));
    await expect(completed.rescheduleSessionSlot(NEW)).rejects.toHaveProperty("status", 409);
    const closed = createSessionOperationsService(makeRepo(baseSession({ status: "completed" })));
    await expect(closed.rescheduleSessionSlot(NEW)).rejects.toHaveProperty("status", 409);
});

test("rescheduleSessionSlot: a lost race that another writer already finished is treated as success", async () => {
    const session = baseSession();
    const repo = makeRepo(session);
    repo.applyReschedule = async () => {
        // another request wins between our read and our write
        Object.assign(session.selectedSlots[0], { status: "cancelled", isRescheduled: true });
        session.selectedSlots.push({ ...slot({ date: NEW.date, startTime: NEW.startTime, endTime: NEW.endTime }), isRescheduled: true, rescheduledFromIndex: 0 });
        return null;
    };
    const ops = createSessionOperationsService(repo);
    const r = await ops.rescheduleSessionSlot(NEW);
    expect(r.newSlotIndex).toBe(1);
});

test("rescheduleSessionSlot: a lost race with no replacement is a 409", async () => {
    const repo = makeRepo(baseSession());
    repo.applyReschedule = async () => null;
    const ops = createSessionOperationsService(repo);
    await expect(ops.rescheduleSessionSlot(NEW)).rejects.toHaveProperty("status", 409);
});