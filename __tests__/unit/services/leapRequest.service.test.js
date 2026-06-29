/**
 * @fileoverview Unit tests for LeapRequest Service.
 * Targets 100% complete statement, branch, and condition coverage.
 */

jest.mock("../../../config/constants", () => ({
    LEAP_REFILL_THRESHOLD: 100,
    LEAP_REFILL_AMOUNT: 500,
}));

jest.mock("../../../utils/mappers/leapRequest.mapper", () => ({
    toLeapRequestDTO: jest.fn((data) => data),
    toLeapRequestListDTO: jest.fn((data) => data),
}));

const createLeapRequestService = require("../../../services/leapRequest.service");
const AppError = require("../../../utils/appError");

describe("Leap Point Request Service (100% Comprehensive Coverage)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findPendingByMentee: jest.fn(),
            findPendingByMenteeOne: jest.fn(),
            findWalletByUser: jest.fn(),
            createRequest: jest.fn(),
            findAllRequests: jest.fn(),
            countAllRequests: jest.fn(),
            countPendingRequests: jest.fn(),
            findRequestById: jest.fn(),
            incrementWalletBalance: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createLeapRequestService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("getMyRequest", () => {
        it("should return the LeapRequest DTO when a pending request is found", async () => {
            const fakeRequest = { _id: "req_1", mentee: "m1", status: "pending" };
            mockRepo.findPendingByMentee.mockResolvedValue(fakeRequest);

            const result = await service.getMyRequest("m1");
            expect(result).toEqual(fakeRequest);
            expect(mockRepo.findPendingByMentee).toHaveBeenCalledWith("m1");
        });

        it("should throw a 404 AppError if no pending request is discovered", async () => {
            mockRepo.findPendingByMentee.mockResolvedValue(null);

            await expect(service.getMyRequest("m1"))
                .rejects.toThrow(new AppError(404, "No pending request"));
        });
    });

    describe("createRequest", () => {
        it("should throw a 400 AppError if a pending request is already outstanding", async () => {
            mockRepo.findPendingByMenteeOne.mockResolvedValue({ _id: "existing_req" });

            await expect(service.createRequest("m1"))
                .rejects.toThrow(new AppError(400, "A pending request already exists."));
        });

        it("should throw a 400 AppError if the wallet balance sits at or above the constant configuration limit threshold", async () => {
            mockRepo.findPendingByMenteeOne.mockResolvedValue(null);
            mockRepo.findWalletByUser.mockResolvedValue({ balance: 100 }); // Threshold is 100

            await expect(service.createRequest("m1"))
                .rejects.toThrow(new AppError(400, "You still have Leap Points remaining."));
        });

        it("should successfully log a new request when wallet values drop past threshold bounds", async () => {
            mockRepo.findPendingByMenteeOne.mockResolvedValue(null);
            mockRepo.findWalletByUser.mockResolvedValue({ balance: 40 });
            const mockSaved = { _id: "new_req", mentee: "m1", currentBalance: 40 };
            mockRepo.createRequest.mockResolvedValue(mockSaved);

            const result = await service.createRequest("m1");
            expect(result.message).toBe("Request submitted successfully.");
            expect(result.request).toEqual(mockSaved);
            expect(mockRepo.createRequest).toHaveBeenCalledWith({ mentee: "m1", currentBalance: 40 });
        });

        it("should safely default balance metrics parameter inputs to zero if the wallet model resolves unassigned or missing balance", async () => {
            mockRepo.findPendingByMenteeOne.mockResolvedValue(null);
            mockRepo.findWalletByUser.mockResolvedValue(null); // wallet is missing entirely
            mockRepo.createRequest.mockResolvedValue({ _id: "req_def" });

            await service.createRequest("m1");
            expect(mockRepo.createRequest).toHaveBeenCalledWith({ mentee: "m1", currentBalance: 0 });

            // Test if wallet object exists but balance key is explicitly undefined or missing
            mockRepo.findWalletByUser.mockResolvedValue({ balance: undefined });
            await service.createRequest("m1");
            expect(mockRepo.createRequest).toHaveBeenLastCalledWith({ mentee: "m1", currentBalance: 0 });
        });
    });

    describe("getAllRequests", () => {
        it("should use fallback boundaries parameters layout defaults when function is called with zero arguments", async () => {
            mockRepo.findAllRequests.mockResolvedValue([]);
            mockRepo.countAllRequests.mockResolvedValue(0);

            // Force testing coverage execution onto the default parameter assignment: = {}
            const result = await service.getAllRequests();
            expect(result.pagination).toEqual({ page: 1, limit: 50, total: 0, pages: 0 });
            expect(mockRepo.findAllRequests).toHaveBeenCalledWith(0, 50);
        });

        it("should parse option contexts cleanly when passed a populated option object block", async () => {
            mockRepo.findAllRequests.mockResolvedValue([]);
            mockRepo.countAllRequests.mockResolvedValue(10);

            // Explicitly pass option properties
            const result = await service.getAllRequests({ page: 2, limit: 10 });
            expect(result.pagination).toEqual({ page: 2, limit: 10, total: 10, pages: 1 });
            expect(mockRepo.findAllRequests).toHaveBeenCalledWith(10, 10);
        });

        it("should fall back gracefully to default numerical constraints when page or limit arguments are unparseable non-integer string data structures", async () => {
            mockRepo.findAllRequests.mockResolvedValue([]);
            mockRepo.countAllRequests.mockResolvedValue(20);

            // Triggers the logical fallback branch evaluate paths: || 1 and || 50
            const result = await service.getAllRequests({ page: "invalid_string_page", limit: "invalid_string_limit" });
            expect(result.pagination).toEqual({ page: 1, limit: 50, total: 20, pages: 1 });
            expect(mockRepo.findAllRequests).toHaveBeenCalledWith(0, 50);
        });

        it("should enforce clamping restrictions boundaries to ensure safe parsing ranges", async () => {
            mockRepo.findAllRequests.mockResolvedValue([]);
            mockRepo.countAllRequests.mockResolvedValue(250);

            // Triggers Math.max(1, ...) and Math.min(100, ...) branch boundaries
            const result = await service.getAllRequests({ page: -5, limit: 500 });
            expect(result.pagination).toEqual({ page: 1, limit: 100, total: 250, pages: 3 });
            expect(mockRepo.findAllRequests).toHaveBeenCalledWith(0, 100);
        });
    });

    describe("getPendingCount", () => {
        it("should return a total count summary from data layer components for badge tracking counts", async () => {
            mockRepo.countPendingRequests.mockResolvedValue(12);
            const result = await service.getPendingCount();
            expect(result).toEqual({ count: 12 });
        });
    });

    describe("approveRequest", () => {
        it("should throw a 404 AppError if the requested tracking key resolves to an empty object pointer", async () => {
            mockRepo.findRequestById.mockResolvedValue(null);

            await expect(service.approveRequest("invalid_id", "admin_1"))
                .rejects.toThrow(new AppError(404, "Request not found"));
        });

        it("should throw a 400 AppError if the status code descriptor is not marked pending", async () => {
            mockRepo.findRequestById.mockResolvedValue({ status: "approved" });

            await expect(service.approveRequest("req_id", "admin_1"))
                .rejects.toThrow(new AppError(400, "Request already processed"));
        });

        it("should atomically allocate wallet token balance values and commit changes to the database logs", async () => {
            const mockRequestDoc = { _id: "r1", status: "pending", mentee: "m1", save: jest.fn() };
            mockRepo.findRequestById.mockResolvedValue(mockRequestDoc);
            mockRepo.incrementWalletBalance.mockResolvedValue({ balance: 540 });

            const result = await service.approveRequest("r1", "admin_1");

            expect(mockRepo.incrementWalletBalance).toHaveBeenCalledWith("m1", 500); // REFILL_AMOUNT is 500
            expect(mockRequestDoc.status).toBe("approved");
            expect(mockRequestDoc.reviewedBy).toBe("admin_1");
            expect(mockRequestDoc.save).toHaveBeenCalled();
            expect(result.newBalance).toBe(540);
        });
    });

    describe("rejectRequest", () => {
        it("should throw a 404 AppError if the target request document does not exist", async () => {
            mockRepo.findRequestById.mockResolvedValue(null);

            await expect(service.rejectRequest("invalid_id", "admin_1"))
                .rejects.toThrow(new AppError(404, "Request not found"));
        });

        it("should throw a 400 AppError if the target request has already been processed", async () => {
            mockRepo.findRequestById.mockResolvedValue({ status: "rejected" });

            await expect(service.rejectRequest("req_id", "admin_1"))
                .rejects.toThrow(new AppError(400, "Request already processed"));
        });

        it("should change the status to rejected without mutating wallet ledger rows", async () => {
            const mockRequestDoc = { _id: "r1", status: "pending", mentee: "m1", save: jest.fn() };
            mockRepo.findRequestById.mockResolvedValue(mockRequestDoc);

            const result = await service.rejectRequest("r1", "admin_1");

            expect(mockRepo.incrementWalletBalance).not.toHaveBeenCalled();
            expect(mockRequestDoc.status).toBe("rejected");
            expect(mockRequestDoc.reviewedBy).toBe("admin_1");
            expect(mockRequestDoc.save).toHaveBeenCalled();
            expect(result.message).toBe("Request rejected.");
        });
    });
});