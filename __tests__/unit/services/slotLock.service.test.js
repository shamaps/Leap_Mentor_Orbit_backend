/**
 * @fileoverview Unit tests for Slot Lock Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

const createSlotLockService = require("../../../services/slotLock.service");

describe("Slot Lock Service Layer (100% Timeline Overlap Sweep Blueprint)", () => {
    let mockRepo, mockLogger, service, basePayload;

    beforeEach(() => {
        mockRepo = {
            findConfirmedBookings: jest.fn(),
            findActiveLocks: jest.fn(),
            refreshOwnLock: jest.fn(),
            createLock: jest.fn(),
            deleteLock: jest.fn(),
            deleteManyLocks: jest.fn(),
            findActiveLocksExcludingUser: jest.fn()
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createSlotLockService(mockRepo, { logger: mockLogger });

        basePayload = {
            mentorId: "mentor_abc",
            date: "2026-07-01",
            startTime: "14:00",
            endTime: "15:00",
            menteeId: "mentee_user_999"
        };

        jest.clearAllMocks();
    });

    describe("lockSlot Action Workflows", () => {
        it("should return 400 if required identification fields evaluate missing", async () => {
            const res = await service.lockSlot({ ...basePayload, date: null });
            expect(res.status).toBe(400);
            expect(res.body.message).toContain("Missing required fields");
        });

        it("should return 409 SLOT_BOOKED if slot intersects an existing confirmed booking", async () => {
            // CONDITION COVERAGE: b.date === date, handles custom alternative selectedSlots vs selectedSlot fields mapping loops
            mockRepo.findConfirmedBookings.mockResolvedValue([
                { selectedSlots: [{ date: "2026-07-01", startTime: "14:30", endTime: "15:30" }] }, // Overlaps 14:00-15:00
                { selectedSlot: { date: "2026-07-02", startTime: "14:00", endTime: "15:00" } }    // Mismatch date
            ]);

            const res = await service.lockSlot(basePayload);
            expect(res.status).toBe(409);
            expect(res.body.code).toBe("SLOT_BOOKED");
        });

        it("should return 409 SLOT_LOCKED if slot intersects an active lock owned by another consumer", async () => {
            // CONDITION COVERAGE: lock.lockedBy !== menteeId but has overlap timeline intersections
            mockRepo.findConfirmedBookings.mockResolvedValue([]);
            mockRepo.findActiveLocks.mockResolvedValue([
                { lockedBy: "someone_else", startTime: "13:30", endTime: "14:30" } // Overlaps
            ]);

            const res = await service.lockSlot(basePayload);
            expect(res.status).toBe(409);
            expect(res.body.code).toBe("SLOT_LOCKED");
        });

        it("should allow a refresh update and return 200 if the overlapping lock belongs to the exact same caller identity", async () => {
            // CONDITION COVERAGE: lock.lockedBy.toString() === menteeId.toString() evaluates true (bypasses overlap lock block)
            mockRepo.findConfirmedBookings.mockResolvedValue([]);
            mockRepo.findActiveLocks.mockResolvedValue([
                { lockedBy: "mentee_user_999", startTime: "14:00", endTime: "15:00" } // Same mentee refresh timer block
            ]);
            mockRepo.refreshOwnLock.mockResolvedValue({ _id: "lock_1", expiresAt: new Date() });

            const res = await service.lockSlot(basePayload);
            expect(res.status).toBe(200);
            expect(mockRepo.refreshOwnLock).toHaveBeenCalled();
            expect(mockRepo.createLock).not.toHaveBeenCalled(); // already owned — no new-claim attempt needed
        });

        it("should call createLock to claim a brand-new slot when the caller doesn't already hold it", async () => {
            mockRepo.findConfirmedBookings.mockResolvedValue([]);
            mockRepo.findActiveLocks.mockResolvedValue([]);
            mockRepo.refreshOwnLock.mockResolvedValue(null); // caller doesn't own a lock here yet
            mockRepo.createLock.mockResolvedValue({ _id: "lock_new" });

            const res = await service.lockSlot(basePayload);
            expect(res.status).toBe(200);
            expect(mockRepo.createLock).toHaveBeenCalled();
        });

        it("should return 409 SLOT_LOCKED if createLock collides with another mentee's lock created at the same instant (the atomic race fix)", async () => {
            // Two mentees can both pass the earlier best-effort overlap check for the exact
            // same slot if their requests land within the same tick — this is the scenario
            // where MongoDB's unique index is the actual backstop, not the application logic.
            mockRepo.findConfirmedBookings.mockResolvedValue([]);
            mockRepo.findActiveLocks.mockResolvedValue([]);
            mockRepo.refreshOwnLock.mockResolvedValue(null);
            const duplicateKeyError = new Error("E11000 duplicate key error");
            duplicateKeyError.code = 11000;
            mockRepo.createLock.mockRejectedValue(duplicateKeyError);

            const res = await service.lockSlot(basePayload);
            expect(res.status).toBe(409);
            expect(res.body.code).toBe("SLOT_LOCKED");
        });

        it("should rethrow non-duplicate-key errors from createLock instead of swallowing them as a lock conflict", async () => {
            mockRepo.findConfirmedBookings.mockResolvedValue([]);
            mockRepo.findActiveLocks.mockResolvedValue([]);
            mockRepo.refreshOwnLock.mockResolvedValue(null);
            mockRepo.createLock.mockRejectedValue(new Error("connection reset"));

            await expect(service.lockSlot(basePayload)).rejects.toThrow("connection reset");
        });
    });

    describe("unlockSlot Action Workflows", () => {
        it("should return 400 response status if mandatory fields parameters evaluate falsy", async () => {
            const res = await service.unlockSlot({ ...basePayload, startTime: undefined });
            expect(res.status).toBe(400);
        });

        it("should call deleteLock cleanly and returns a 200 success response layout upon matched data maps", async () => {
            const res = await service.unlockSlot(basePayload);
            expect(res.status).toBe(200);
            expect(mockRepo.deleteLock).toHaveBeenCalled();
        });
    });

    describe("unlockAllByMentee Action Workflows", () => {
        it("should dynamically build filters with mentorId parameter restrictions if provided", async () => {
            const res = await service.unlockAllByMentee({ mentorId: "m1", menteeId: "me1" });
            expect(res.status).toBe(200);
            expect(mockRepo.deleteManyLocks).toHaveBeenCalledWith({ mentorId: "m1", lockedBy: "me1" });
        });

        it("should omit mentorId keys from filter maps if parameter evaluates falsy", async () => {
            await service.unlockAllByMentee({ mentorId: null, menteeId: "me1" });
            expect(mockRepo.deleteManyLocks).toHaveBeenCalledWith({ lockedBy: "me1" });
        });
    });

    describe("getActiveLocks Action Workflows", () => {
        it("should load concurrent opposing elements records successfully", async () => {
            mockRepo.findActiveLocksExcludingUser.mockResolvedValue([{ startTime: "09:00" }]);
            const res = await service.getActiveLocks({ mentorId: "m1", userId: "u1" });
            expect(res.status).toBe(200);
            expect(res.body.locks).toHaveLength(1);
        });
    });
});