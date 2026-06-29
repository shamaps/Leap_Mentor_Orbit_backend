/**
 * @fileoverview Unit tests for LeapRequest Controller.
 * Targets 100% complete statement, branch, and functional coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    created: jest.fn((res, data) => res.status(201).json(data)),
}));

const createLeapRequestController = require("../../../controllers/leapRequest.controller");
const { handleError } = require("../../../utils/appError");
const { ok, created } = require("../../../utils/response");

describe("LeapRequest Controller (100% Comprehensive Coverage)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            getMyRequest: jest.fn(),
            createRequest: jest.fn(),
            getAllRequests: jest.fn(),
            getPendingCount: jest.fn(),
            approveRequest: jest.fn(),
            rejectRequest: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createLeapRequestController(mockService, { logger: mockLogger });

        req = {
            body: {},
            params: {},
            query: {},
            user: { _id: "mentee_user_777" },
            admin: { _id: "admin_user_888" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("getMyRequest endpoint", () => {
        it("should return the pending request and respond with an 200 status code", async () => {
            const mockData = { _id: "req_1", mentee: "mentee_user_777", status: "pending" };
            mockService.getMyRequest.mockResolvedValue(mockData);

            await controller.getMyRequest(req, res);

            expect(mockService.getMyRequest).toHaveBeenCalledWith("mentee_user_777");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should delegate failures to the standard handleError pipeline", async () => {
            const error = new Error("No pending request exists");
            mockService.getMyRequest.mockRejectedValue(error);

            await controller.getMyRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "leapRequest.getMyRequest");
        });
    });

    describe("createRequest endpoint", () => {
        it("should successfully log a new points request and return a 201 status code", async () => {
            const mockData = { message: "Request submitted successfully.", request: {} };
            mockService.createRequest.mockResolvedValue(mockData);

            await controller.createRequest(req, res);

            expect(mockService.createRequest).toHaveBeenCalledWith("mentee_user_777");
            expect(created).toHaveBeenCalledWith(res, mockData);
        });

        it("should direct creation exceptions safely through errorHandler middleware", async () => {
            const error = new Error("A pending request already exists.");
            mockService.createRequest.mockRejectedValue(error);

            await controller.createRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "leapRequest.createRequest");
        });
    });

    describe("getAllRequests endpoint", () => {
        it("should pass query configurations down to service layer pagination methods", async () => {
            req.query = { page: "2", limit: "25" };
            const mockData = { requests: [], pagination: {} };
            mockService.getAllRequests.mockResolvedValue(mockData);

            await controller.getAllRequests(req, res);

            expect(mockService.getAllRequests).toHaveBeenCalledWith({ page: "2", limit: "25" });
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should route structural processing faults directly to catch handlers", async () => {
            const error = new Error("Unauthorized data aggregation view");
            mockService.getAllRequests.mockRejectedValue(error);

            await controller.getAllRequests(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "leapRequest.getAllRequests");
        });
    });

    describe("getPendingCount endpoint", () => {
        it("should successfully extract total outstanding pending requests count data", async () => {
            const mockData = { count: 5 };
            mockService.getPendingCount.mockResolvedValue(mockData);

            await controller.getPendingCount(req, res);

            expect(mockService.getPendingCount).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should gracefully handle execution exceptions on badge tracking requests", async () => {
            const error = new Error("Database counting layer failure");
            mockService.getPendingCount.mockRejectedValue(error);

            await controller.getPendingCount(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "leapRequest.getPendingCount");
        });
    });

    describe("approveRequest endpoint", () => {
        it("should approve the targeted request and pass authenticated admin credentials details", async () => {
            req.params.id = "req_123";
            const mockData = { message: "LP added successfully", newBalance: 600 };
            mockService.approveRequest.mockResolvedValue(mockData);

            await controller.approveRequest(req, res);

            expect(mockService.approveRequest).toHaveBeenCalledWith("req_123", "admin_user_888");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should route approval exceptions safely to the handleError interceptor", async () => {
            req.params.id = "req_123";
            const error = new Error("Request already processed");
            mockService.approveRequest.mockRejectedValue(error);

            await controller.approveRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "leapRequest.approveRequest");
        });
    });

    describe("rejectRequest endpoint", () => {
        it("should reject the request profile row without changing active ledger balances", async () => {
            req.params.id = "req_123";
            const mockData = { message: "Request rejected." };
            mockService.rejectRequest.mockResolvedValue(mockData);

            await controller.rejectRequest(req, res);

            expect(mockService.rejectRequest).toHaveBeenCalledWith("req_123", "admin_user_888");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should catch rejection routine errors and route them to standard handlers", async () => {
            req.params.id = "req_123";
            const error = new Error("Target document does not exist");
            mockService.rejectRequest.mockRejectedValue(error);

            await controller.rejectRequest(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "leapRequest.rejectRequest");
        });
    });
});