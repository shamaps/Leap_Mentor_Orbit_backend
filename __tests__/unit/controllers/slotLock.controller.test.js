jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createSlotLockController = require("../../../controllers/slotLock.controller");
const { ok } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Slot Lock Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            lockSlot: jest.fn(),
            unlockSlot: jest.fn(),
            unlockAllByMentee: jest.fn(),
            getActiveLocks: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createSlotLockController(mockService, { logger: mockLogger });

        req = { user: { _id: "mentee_uid_100" }, body: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("lockSlot", () => {
        it("should forward route body properties and wrap the outcome in a status 200 envelope", async () => {
            req.body = { mentorId: "mentor_uid_200", date: "2026-07-06", startTime: "09:00", endTime: "10:00" };
            const servicePayload = { message: "Slot locked successfully" };
            mockService.lockSlot.mockResolvedValue({ body: servicePayload });

            await controller.lockSlot(req, res);

            expect(mockService.lockSlot).toHaveBeenCalledWith({
                mentorId: "mentor_uid_200",
                date: "2026-07-06",
                startTime: "09:00",
                endTime: "10:00",
                menteeId: "mentee_uid_100",
            });
            expect(ok).toHaveBeenCalledWith(res, servicePayload);
        });

        it("should safely channel execution failures down into fallback application error utilities", async () => {
            const error = new Error("Database transaction aborted");
            mockService.lockSlot.mockRejectedValue(error);

            await controller.lockSlot(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "slotLock.lockSlot");
        });
    });

    describe("unlockAllByMentee", () => {
        it("should extract optional mentor modifiers along with user tokens to clear bulk holds", async () => {
            req.body = { mentorId: "mentor_uid_200" };
            mockService.unlockAllByMentee.mockResolvedValue({ body: { message: "All locks released" } });

            await controller.unlockAllByMentee(req, res);

            expect(mockService.unlockAllByMentee).toHaveBeenCalledWith({
                mentorId: "mentor_uid_200",
                menteeId: "mentee_uid_100",
            });
        });
    });
});