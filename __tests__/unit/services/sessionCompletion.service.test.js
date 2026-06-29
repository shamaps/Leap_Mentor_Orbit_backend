jest.mock("mongoose", () => ({
    startSession: jest.fn(() => ({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        endSession: jest.fn(),
    })),
}));

jest.mock("../../../utils/releaseEscrow", () => jest.fn(() => Promise.resolve({ released: true })));
jest.mock("../../../utils/cache", () => ({
    del: jest.fn().mockResolvedValue(),
    NS: { PLATFORM_SETTINGS: "platform_settings" },
}));
jest.mock("../../../utils/mappers/session.mapper", () => ({
    toMarkCompleteDTO: jest.fn((data) => data),
}));

const createSessionCompletionService = require("../../../services/sessionCompletion.service");

describe("Session Completion Service (Unit)", () => {
    let mockSessionRepo, mockEscrowRepo, mockSlotMutationService, mockLogger, service, mockConnectRequest;

    beforeEach(() => {
        mockSessionRepo = {};
        mockEscrowRepo = {};
        mockSlotMutationService = {
            loadAndValidateSlot: jest.fn(),
            emitSlotUpdate: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

        service = createSessionCompletionService(
            mockSessionRepo,
            mockEscrowRepo,
            mockSlotMutationService,
            { logger: mockLogger }
        );

        mockConnectRequest = {
            mentor: "mentor_uid_456",
            mentee: "mentee_uid_789",
            selectedSlots: [
                { status: "pending", menteeMarked: false, mentorMarked: false, completedAt: null },
            ],
            markModified: jest.fn(),
            save: jest.fn().mockResolvedValue(),
        };

        jest.clearAllMocks();
    });

    it("should throw a 400 AppError if the target slot is marked as cancelled", async () => {
        mockConnectRequest.selectedSlots[0].status = "cancelled";
        mockSlotMutationService.loadAndValidateSlot.mockResolvedValue({
            connectRequest: mockConnectRequest,
            idx: 0,
        });

        await expect(service.markSlotComplete("connect_01", "0", "mentee_uid_789"))
            .rejects.toMatchObject({ status: 400, message: "Cannot mark a cancelled slot as complete" });
    });

    it("should mark a single role completion, modification flag indicators, and resolve transaction loop seamlessly", async () => {
        mockSlotMutationService.loadAndValidateSlot.mockResolvedValue({
            connectRequest: mockConnectRequest,
            idx: 0,
        });

        const result = await service.markSlotComplete("connect_01", "0", "mentee_uid_789");

        expect(mockConnectRequest.selectedSlots[0].menteeMarked).toBe(true);
        expect(mockConnectRequest.markModified).toHaveBeenCalledWith("selectedSlots");
        expect(mockConnectRequest.save).toHaveBeenCalled();
        expect(result.bothMarked).toBe(false);
    });

    it("should trigger financial escrow releases and wipe platform cache variables if all active slots are successfully finalized", async () => {
        // Single slot, marking by the second person (mentor) completing the total series pass
        mockConnectRequest.selectedSlots[0].menteeMarked = true;
        mockSlotMutationService.loadAndValidateSlot.mockResolvedValue({
            connectRequest: mockConnectRequest,
            idx: 0,
        });

        const cache = require("../../../utils/cache");
        const releaseEscrow = require("../../../utils/releaseEscrow");

        const result = await service.markSlotComplete("connect_01", "0", "mentor_uid_456");

        expect(mockConnectRequest.selectedSlots[0].mentorMarked).toBe(true);
        expect(mockConnectRequest.selectedSlots[0].completedAt).toBeInstanceOf(Date);
        expect(releaseEscrow).toHaveBeenCalled();
        expect(cache.del).toHaveBeenCalledWith("platform_settings");
        expect(result.allComplete).toBe(true);
    });
});