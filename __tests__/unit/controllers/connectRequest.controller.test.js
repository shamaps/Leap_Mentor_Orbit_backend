jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    created: jest.fn((res, data) => res.status(201).json({ success: true, data })),
    fail: jest.fn((res, msg, status) => res.status(status).json({ success: false, error: msg })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createConnectRequestController = require("../../../controllers/connectRequest.controller");
const { ok, created, fail, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Connect Request Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            sendRequest: jest.fn(),
            getMyRequests: jest.fn(),
            getIncomingRequests: jest.fn(),
            respondToRequest: jest.fn(),
            cancelRequest: jest.fn(),
            referRequest: jest.fn(),
            getOngoingConnects: jest.fn(),
            getConnectDetail: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createConnectRequestController(mockService, { logger: mockLogger });

        req = { user: { _id: "mentee_123", name: "Alice" }, body: {}, query: {}, params: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("sendConnectRequest", () => {
        it("should extract payload parameters and issue status 201 created on success", async () => {
            req.body = { mentorId: "mentor_456", message: "Hey", selectedSlots: [{ date: "2026-07-06" }] };
            mockService.sendRequest.mockResolvedValue({ _id: "req_999" });

            await controller.sendConnectRequest(req, res);

            expect(mockService.sendRequest).toHaveBeenCalledWith({
                mentorId: "mentor_456",
                menteeId: "mentee_123",
                menteeName: "Alice",
                message: "Hey",
                selectedSlots: req.body.selectedSlots,
                sessionRate: undefined,
                sessionCount: undefined,
            });
            expect(created).toHaveBeenCalled();
        });

        it("should catch duplicate key mongo server errors and return a 409 conflict envelope", async () => {
            req.body = { mentorId: "mentor_456" };
            const mongoError = new Error("E11000 duplicate key index");
            mongoError.code = 11000;
            mockService.sendRequest.mockRejectedValue(mongoError);

            await controller.sendConnectRequest(req, res);

            expect(fail).toHaveBeenCalledWith(res, "You already have a pending request with this mentor", 409);
        });
    });

    describe("respondToRequest", () => {
        it("should successfully structure incoming body payload inputs into the service layer wrapper object", async () => {
            req.params.id = "req_123";
            req.body = { status: "accepted", confirmedSlot: { date: "2026-07-06" } };
            mockService.respondToRequest.mockResolvedValue({});

            await controller.respondToRequest(req, res);

            expect(mockService.respondToRequest).toHaveBeenCalledWith({
                requestId: "req_123",
                mentorUserId: "mentee_123",
                status: "accepted",
                confirmedSlot: req.body.confirmedSlot,
            });
            expect(ok).toHaveBeenCalled();
        });
    });
});