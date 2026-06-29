const createSlotLockService = require("../../../services/slotLock.service");

describe("Slot Lock Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findConfirmedBookings: jest.fn(),
            findActiveLocks: jest.fn(),
            upsertLock: jest.fn(),
            deleteLock: jest.fn(),
            deleteManyLocks: jest.fn(),
            findActiveLocksExcludingUser: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createSlotLockService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("lockSlot", () => {
        it("should return status 400 if required parameters are missing", async () => {
            const result = await service.lockSlot({ mentorId: "m1", date: "2026-07-06" }); // missing times
            expect(result.status).toBe(400);
            expect(result.body.message).toBe("Missing required fields");
        });

        it("should reject with status 409 if an active confirmed booking overlaps the targeted frame", async () => {
            mockRepo.findConfirmedBookings.mockResolvedValue([
                { selectedSlots: [{ date: "2026-07-06", startTime: "09:30", endTime: "10:30" }] }
            ]);

            const result = await service.lockSlot({
                mentorId: "m1", date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId: "mentee_1"
            });

            expect(result.status).toBe(409);
            expect(result.body.code).toBe("SLOT_BOOKED");
        });

        it("should reject with status 409 if another user currently holds a temporary active lock", async () => {
            mockRepo.findConfirmedBookings.mockResolvedValue([]);
            mockRepo.findActiveLocks.mockResolvedValue([
                { date: "2026-07-06", startTime: "09:15", endTime: "09:45", lockedBy: "other_mentee" }
            ]);

            const result = await service.lockSlot({
                mentorId: "m1", date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId: "mentee_1"
            });

            expect(result.status).toBe(409);
            expect(result.body.code).toBe("SLOT_LOCKED");
        });

        it("should allow a user to re-lock/refresh their own active temporary lock seamlessly", async () => {
            mockRepo.findConfirmedBookings.mockResolvedValue([]);
            mockRepo.findActiveLocks.mockResolvedValue([
                { date: "2026-07-06", startTime: "09:00", endTime: "10:00", lockedBy: "mentee_1" }
            ]);

            const result = await service.lockSlot({
                mentorId: "m1", date: "2026-07-06", startTime: "09:00", endTime: "10:00", menteeId: "mentee_1"
            });

            expect(result.status).toBe(200);
            expect(mockRepo.upsertLock).toHaveBeenCalled();
        });
    });
});