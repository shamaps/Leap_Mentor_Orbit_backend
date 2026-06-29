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

        it("should forward non-duplicate errors to handleError", async () => {
            req.body = { mentorId: "mentor_456" };
            const err = new Error("Unexpected failure");
            mockService.sendRequest.mockRejectedValue(err);

            await controller.sendConnectRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.sendConnectRequest");
        });
    });

    describe("getMyRequests", () => {
        it("should call service with the authenticated user id and return requests in ok envelope", async () => {
            const requests = [{ _id: "r1" }, { _id: "r2" }];
            mockService.getMyRequests.mockResolvedValue(requests);

            await controller.getMyRequests(req, res);

            expect(mockService.getMyRequests).toHaveBeenCalledWith("mentee_123");
            expect(ok).toHaveBeenCalledWith(res, { requests });
        });

        it("should forward service errors to handleError", async () => {
            const err = new Error("DB failure");
            mockService.getMyRequests.mockRejectedValue(err);

            await controller.getMyRequests(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.getMyRequests");
        });
    });

    describe("getIncomingRequests", () => {
        it("should pass user id and optional status query param to service", async () => {
            req.query = { status: "pending" };
            const requests = [{ _id: "r3" }];
            mockService.getIncomingRequests.mockResolvedValue(requests);

            await controller.getIncomingRequests(req, res);

            expect(mockService.getIncomingRequests).toHaveBeenCalledWith("mentee_123", "pending");
            expect(ok).toHaveBeenCalledWith(res, { requests });
        });

        it("should forward service errors to handleError", async () => {
            const err = new Error("Service error");
            mockService.getIncomingRequests.mockRejectedValue(err);

            await controller.getIncomingRequests(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.getIncomingRequests");
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

        it("should forward service errors to handleError", async () => {
            req.params.id = "req_123";
            req.body = { status: "rejected" };
            const err = new Error("Not found");
            err.status = 404;
            mockService.respondToRequest.mockRejectedValue(err);

            await controller.respondToRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.respondToRequest");
        });
    });

    describe("cancelRequest", () => {
        it("should call service with request id and user id, then return 204 no content", async () => {
            req.params.id = "req_del_001";
            mockService.cancelRequest.mockResolvedValue();

            await controller.cancelRequest(req, res);

            expect(mockService.cancelRequest).toHaveBeenCalledWith("req_del_001", "mentee_123");
            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should forward service errors to handleError", async () => {
            req.params.id = "req_del_001";
            const err = new Error("Cannot cancel ongoing session");
            err.status = 400;
            mockService.cancelRequest.mockRejectedValue(err);

            await controller.cancelRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.cancelRequest");
        });
    });

    describe("referRequest", () => {
        it("should call service with original id, caller id, and target mentor id, returning ok envelope", async () => {
            req.params.id = "req_orig_001";
            req.body = { referToMentorId: "mentor_new_999" };
            const originalRequest = { _id: "req_orig_001", status: "referred" };
            const newRequest = { _id: "req_new_002" };
            mockService.referRequest.mockResolvedValue({ originalRequest, newRequest });

            await controller.referRequest(req, res);

            expect(mockService.referRequest).toHaveBeenCalledWith("req_orig_001", "mentee_123", "mentor_new_999");
            expect(ok).toHaveBeenCalledWith(res, {
                message: "Request referred successfully",
                originalRequest,
                newRequest,
            });
        });

        it("should forward service errors to handleError", async () => {
            req.params.id = "req_orig_001";
            req.body = { referToMentorId: "mentor_new_999" };
            const err = new Error("Self-referral not allowed");
            err.status = 400;
            mockService.referRequest.mockRejectedValue(err);

            await controller.referRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.referRequest");
        });
    });

    describe("getOngoingConnects", () => {
        it("should return ongoing connections for the authenticated user", async () => {
            const connects = [{ _id: "conn_1", status: "ongoing" }];
            mockService.getOngoingConnects.mockResolvedValue(connects);

            await controller.getOngoingConnects(req, res);

            expect(mockService.getOngoingConnects).toHaveBeenCalledWith("mentee_123");
            expect(ok).toHaveBeenCalledWith(res, { connects });
        });

        it("should forward service errors to handleError", async () => {
            const err = new Error("DB failure");
            mockService.getOngoingConnects.mockRejectedValue(err);

            await controller.getOngoingConnects(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.getOngoingConnects");
        });
    });

    describe("getConnectDetail", () => {
        it("should return full details for a single connect request by id", async () => {
            req.params.id = "req_detail_007";
            const connect = { _id: "req_detail_007", status: "ongoing", mentor: {}, mentee: {} };
            mockService.getConnectDetail.mockResolvedValue(connect);

            await controller.getConnectDetail(req, res);

            expect(mockService.getConnectDetail).toHaveBeenCalledWith("req_detail_007", "mentee_123");
            expect(ok).toHaveBeenCalledWith(res, { connect });
        });

        it("should forward service errors to handleError", async () => {
            req.params.id = "req_detail_007";
            const err = new Error("Forbidden");
            err.status = 403;
            mockService.getConnectDetail.mockRejectedValue(err);

            await controller.getConnectDetail(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "connectRequest.getConnectDetail");
        });
    });
});