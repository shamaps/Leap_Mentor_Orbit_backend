jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createSessionController = require("../../../controllers/session.controller");
const { ok, created } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Session Controller (Unit)", () => {
    let mockSessionService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockSessionService = {
            getSlots: jest.fn(),
            setMeetingLink: jest.fn(),
            markSlotComplete: jest.fn(),
            addSlot: jest.fn(),
            cancelSlot: jest.fn(),
            rescheduleSlot: jest.fn(),
            getMentorAvailability: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createSessionController(mockSessionService, { logger: mockLogger });

        req = { user: { _id: "user_actor_123" }, params: {}, query: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getSlots", () => {
        it("should extract route parameters and deliver scheduling slots successfully with status 200", async () => {
            req.params.connectRequestId = "connect_req_001";
            const mockSlotsData = { slots: [] };
            mockSessionService.getSlots.mockResolvedValue(mockSlotsData);

            await controller.getSlots(req, res);

            expect(mockSessionService.getSlots).toHaveBeenCalledWith("connect_req_001", "user_actor_123");
            expect(ok).toHaveBeenCalledWith(res, mockSlotsData);
        });

        it("should channel execution errors safely to global application handlers", async () => {
            const testError = new Error("DB Connection timed out");
            mockSessionService.getSlots.mockRejectedValue(testError);

            await controller.getSlots(req, res);

            expect(handleError).toHaveBeenCalledWith(res, testError, "session.getSlots");
        });
    });

    describe("setMeetingLink", () => {
        it("should parse inputs into a configured object profile structure to meet the service refactor layout", async () => {
            req.params.connectRequestId = "connect_req_001";
            req.params.slotIndex = "0";
            req.body.meetingLink = "https://meet.google.com/abc-defg-hij";
            mockSessionService.setMeetingLink.mockResolvedValue({ updated: true });

            await controller.setMeetingLink(req, res);

            expect(mockSessionService.setMeetingLink).toHaveBeenCalledWith({
                connectRequestId: "connect_req_001",
                slotIndex: "0",
                meetingLink: "https://meet.google.com/abc-defg-hij",
                userId: "user_actor_123",
            });
            expect(ok).toHaveBeenCalledWith(res, expect.objectContaining({ message: "Meeting link updated" }));
        });
    });

    describe("cancelSlot", () => {
        it("should map explicit reasons alongside request metrics into an object payload context wrapper", async () => {
            req.params.connectRequestId = "connect_req_001";
            req.params.slotIndex = "1";
            req.body.reason = "Scheduling conflict";
            mockSessionService.cancelSlot.mockResolvedValue({ cancelled: true });

            await controller.cancelSlot(req, res);

            expect(mockSessionService.cancelSlot).toHaveBeenCalledWith({
                connectRequestId: "connect_req_001",
                slotIndex: "1",
                userId: "user_actor_123",
                reason: "Scheduling conflict",
            });
            expect(ok).toHaveBeenCalledWith(res, expect.objectContaining({ message: "Slot cancelled successfully" }));
        });
    });
});