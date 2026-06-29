/**
 * @fileoverview Unit tests for Slot Lock Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
}));

const createSlotLockController = require("../../../controllers/slotLock.controller");
const { handleError } = require("../../../utils/appError");
const { ok } = require("../../../utils/response");

describe("Slot Lock Controller (100% Comprehensive Coverage Blueprint)", () => {
    let mockSlotLockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockSlotLockService = {
            lockSlot: jest.fn(),
            unlockSlot: jest.fn(),
            unlockAllByMentee: jest.fn(),
            getActiveLocks: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createSlotLockController(mockSlotLockService, { logger: mockLogger });

        req = {
            params: { mentorId: "mentor_abc_123" },
            body: {
                mentorId: "mentor_abc_123",
                date: "2026-07-15",
                startTime: "14:00",
                endTime: "15:00"
            },
            user: { _id: "mentee_xyz_789" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("lockSlot Endpoint", () => {
        it("should register a calendar transient lock hold successfully", async () => {
            const mockBody = { success: true, lockId: "lock_001" };
            mockSlotLockService.lockSlot.mockResolvedValue({ status: 200, body: mockBody });

            await controller.lockSlot(req, res);

            expect(mockSlotLockService.lockSlot).toHaveBeenCalledWith({
                mentorId: "mentor_abc_123",
                date: "2026-07-15",
                startTime: "14:00",
                endTime: "15:00",
                menteeId: "mentee_xyz_789",
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should catch exceptions and route down to handleError middleware", async () => {
            const err = new Error("Slot collision or slot already locked");
            mockSlotLockService.lockSlot.mockRejectedValue(err);

            await controller.lockSlot(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "slotLock.lockSlot");
        });
    });

    describe("unlockSlot Endpoint", () => {
        it("should clear an individual explicit scheduling lock hold successfully", async () => {
            const mockBody = { success: true, message: "Unlocked single slot" };
            mockSlotLockService.unlockSlot.mockResolvedValue({ status: 200, body: mockBody });

            await controller.unlockSlot(req, res);

            expect(mockSlotLockService.unlockSlot).toHaveBeenCalledWith({
                mentorId: "mentor_abc_123",
                date: "2026-07-15",
                startTime: "14:00",
                endTime: "15:00",
                menteeId: "mentee_xyz_789",
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should route unlockSlot errors down through handleError handler", async () => {
            const err = new Error("Lock execution context missing");
            mockSlotLockService.unlockSlot.mockRejectedValue(err);

            await controller.unlockSlot(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "slotLock.unlockSlot");
        });
    });

    describe("unlockAllByMentee Endpoint", () => {
        it("should release the entire set of holdings owned by the mentee user successfully", async () => {
            const mockBody = { success: true, releasedCount: 3 };
            mockSlotLockService.unlockAllByMentee.mockResolvedValue({ status: 200, body: mockBody });

            await controller.unlockAllByMentee(req, res);

            expect(mockSlotLockService.unlockAllByMentee).toHaveBeenCalledWith({
                mentorId: "mentor_abc_123",
                menteeId: "mentee_xyz_789",
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should route batch cancellation errors directly to handleError", async () => {
            const err = new Error("Database cluster multi-write fault");
            mockSlotLockService.unlockAllByMentee.mockRejectedValue(err);

            await controller.unlockAllByMentee(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "slotLock.unlockAllByMentee");
        });
    });

    describe("getActiveLocks Endpoint", () => {
        it("should extract third-party active slots segments list successfully", async () => {
            const mockBody = { activeLocks: [] };
            mockSlotLockService.getActiveLocks.mockResolvedValue({ status: 200, body: mockBody });

            await controller.getActiveLocks(req, res);

            expect(mockSlotLockService.getActiveLocks).toHaveBeenCalledWith({
                mentorId: "mentor_abc_123",
                userId: "mentee_xyz_789",
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should send active locks query exceptions through to handleError", async () => {
            const err = new Error("Provider schedule read error");
            mockSlotLockService.getActiveLocks.mockRejectedValue(err);

            await controller.getActiveLocks(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "slotLock.getActiveLocks");
        });
    });
});