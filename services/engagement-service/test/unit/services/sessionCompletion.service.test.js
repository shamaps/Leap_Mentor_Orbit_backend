/**
 * @fileoverview Unit tests for SessionCompletion Service.
 * Slot confirmation is owned by the catalog service and the escrow release by the
 * payments service; both are reached through the compensation runner, so these tests
 * check the order of those calls, what is re-read afterwards, and the failure paths.
 */

jest.mock("@leapmentor/shared/utils/cache", () => ({
    del: jest.fn(),
    NS: { PLATFORM_SETTINGS: "platform_settings_key" },
}));

jest.mock("@leapmentor/shared/utils/mappers/session.mapper", () => ({
    toMarkCompleteDTO: jest.fn((data) => data),
}));

jest.mock("../../../src/services/sessionHelpers", () => ({
    computeProgress: jest.fn(),
    buildCompleteMessage: jest.fn().mockReturnValue("Stubbed notification message"),
}));

const createSessionCompletionService = require("../../../src/services/sessionCompletion.service");
const cache = require("@leapmentor/shared/utils/cache");
const helpers = require("../../../src/services/sessionHelpers");

describe("SessionCompletion Service", () => {
    let mockSessionRepo, mockCompensation, mockSlotMutationService, mockLogger, service, mockConnectRequest;

    const progress = (overrides = {}) => ({
        totalSlots: 1, completedSlots: 1, progress: 100,
        activeSlots: [{ menteeMarked: true, mentorMarked: true }],
        ...overrides,
    });

    beforeEach(() => {
        mockConnectRequest = {
            mentor: "mentor_abc",
            mentee: "mentee_xyz",
            selectedSlots: [{ status: "pending", menteeMarked: false, mentorMarked: false }],
        };

        mockSessionRepo = { findSessionDocument: jest.fn() };
        mockCompensation = { run: jest.fn().mockResolvedValue({}) };
        mockSlotMutationService = {
            loadAndValidateSlot: jest.fn().mockResolvedValue({ connectRequest: mockConnectRequest, idx: 0 }),
            emitSlotUpdate: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

        service = createSessionCompletionService(mockSessionRepo, mockCompensation, mockSlotMutationService, { logger: mockLogger });

        jest.clearAllMocks();
        // jest.clearAllMocks keeps implementations, but the re-read result is per test
        mockSessionRepo.findSessionDocument.mockResolvedValue({
            ...mockConnectRequest,
            selectedSlots: [{ status: "pending", menteeMarked: true, mentorMarked: false }],
        });
        helpers.buildCompleteMessage.mockReturnValue("Stubbed notification message");
    });

    describe("Validation gates", () => {
        it("should throw AppError 400 if the target slot is cancelled, before calling any other service", async () => {
            mockConnectRequest.selectedSlots[0].status = "cancelled";

            await expect(service.markSlotComplete("cr_123", 0, "mentee_xyz"))
                .rejects.toMatchObject({ status: 400, message: "Cannot mark a cancelled slot as complete" });

            expect(mockCompensation.run).not.toHaveBeenCalled();
            expect(mockLogger.error).toHaveBeenCalledWith("markSlotComplete downstream operation failed", expect.any(Object));
        });

        it("should throw AppError 404 when the session cannot be re-read after the catalog confirmation", async () => {
            mockSessionRepo.findSessionDocument.mockResolvedValue(null);

            await expect(service.markSlotComplete("cr_123", 0, "mentee_xyz"))
                .rejects.toMatchObject({ status: 404, message: "Session not found after confirmation" });
            expect(mockCompensation.run).toHaveBeenCalledTimes(1); // confirmed, but nothing released
        });

        it("should log and rethrow when the catalog confirmation fails, and not release escrow", async () => {
            mockCompensation.run.mockRejectedValueOnce(new Error("catalog unavailable"));

            await expect(service.markSlotComplete("cr_123", 0, "mentee_xyz")).rejects.toThrow("catalog unavailable");
            expect(mockLogger.error).toHaveBeenCalled();
            expect(slotUpdateEmitted()).toBe(false);
        });
    });

    describe("Progress and release conditions", () => {
        it("should confirm the slot through the catalog and report a half-marked slot when the mentor is acting", async () => {
            helpers.computeProgress.mockReturnValue(progress({ completedSlots: 0, progress: 0, activeSlots: [{ menteeMarked: false, mentorMarked: true }] }));

            const result = await service.markSlotComplete("cr_123", 0, "mentor_abc");

            expect(mockCompensation.run).toHaveBeenCalledWith(
                "catalog.confirmSlot",
                { requestId: "cr_123", slotIndex: 0, userId: "mentor_abc" },
                "catalog:confirm:cr_123:0:mentor_abc",
            );
            expect(result.bothMarked).toBe(false);
            expect(result.allComplete).toBe(false);
            expect(helpers.buildCompleteMessage).toHaveBeenCalledWith(false, false, false); // acting user is the mentor
        });

        it("should not release escrow when there are no active slots", async () => {
            helpers.computeProgress.mockReturnValue(progress({ activeSlots: [] }));

            const result = await service.markSlotComplete("cr_123", 0, "mentee_xyz");

            expect(result.allComplete).toBe(false);
            expect(mockCompensation.run).not.toHaveBeenCalledWith("payments.release", expect.anything(), expect.anything());
        });

        it("should not release escrow while another active slot is still unmarked", async () => {
            helpers.computeProgress.mockReturnValue(progress({
                totalSlots: 2, completedSlots: 1, progress: 50,
                activeSlots: [{ menteeMarked: true, mentorMarked: true }, { menteeMarked: false, mentorMarked: false }],
            }));

            const result = await service.markSlotComplete("cr_123", 0, "mentee_xyz");

            expect(result.allComplete).toBe(false);
            expect(result.escrowRelease).toBeNull();
            expect(cache.del).not.toHaveBeenCalled();
        });

        it("should release escrow through payments once every active slot is marked by both sides", async () => {
            mockSessionRepo.findSessionDocument.mockResolvedValue({
                ...mockConnectRequest,
                selectedSlots: [{ status: "pending", menteeMarked: true, mentorMarked: true }],
            });
            helpers.computeProgress.mockReturnValue(progress());
            mockCompensation.run.mockResolvedValueOnce({}).mockResolvedValueOnce({ status: "completed" });

            const result = await service.markSlotComplete("cr_123", 0, "mentee_xyz");

            expect(mockCompensation.run).toHaveBeenLastCalledWith(
                "payments.release",
                { requestId: "cr_123", menteeId: "mentee_xyz" },
                "cr_123:release",
            );
            expect(result).toMatchObject({ allComplete: true, bothMarked: true, escrowRelease: { status: "completed" } });
            expect(cache.del).toHaveBeenCalledWith(cache.NS.PLATFORM_SETTINGS);
            expect(mockSlotMutationService.emitSlotUpdate).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ allComplete: true, progress: 100 }));
        });
    });

    describe("Cache eviction and release failures", () => {
        it("should still succeed and warn when the platform settings cache cannot be cleared", async () => {
            helpers.computeProgress.mockReturnValue(progress());
            cache.del.mockRejectedValueOnce(new Error("Redis cache cluster node error simulation"));

            const result = await service.markSlotComplete("cr_123", 0, "mentee_xyz");

            expect(result.allComplete).toBe(true);
            expect(mockLogger.warn).toHaveBeenCalledWith("cache.del PLATFORM_SETTINGS failed after markSlotComplete", expect.any(Object));
        });

        it("should rethrow a payments release failure without clearing the cache or emitting a socket update", async () => {
            helpers.computeProgress.mockReturnValue(progress());
            mockCompensation.run.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("payments unavailable"));

            await expect(service.markSlotComplete("cr_123", 0, "mentee_xyz")).rejects.toThrow("payments unavailable");
            expect(cache.del).not.toHaveBeenCalled();
            expect(slotUpdateEmitted()).toBe(false);
        });
    });

    function slotUpdateEmitted() {
        return mockSlotMutationService.emitSlotUpdate.mock.calls.length > 0;
    }
});
