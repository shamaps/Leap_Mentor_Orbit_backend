// Mock the child services composed by the facade
const mockSlotMutation = {
    getSlots: jest.fn(),
    getMentorAvailability: jest.fn(),
    setMeetingLink: jest.fn(),
    addSlot: jest.fn(),
    cancelSlot: jest.fn(),
    rescheduleSlot: jest.fn(),
};

const mockCompletion = {
    markSlotComplete: jest.fn(),
};

// Intercept factory initializations to return our tracked spy blocks
jest.mock("../../../services/slotMutation.service", () => jest.fn(() => mockSlotMutation));
jest.mock("../../../services/sessionCompletion.service", () => jest.fn(() => mockCompletion));

const createSessionService = require("../../../services/session.service");

describe("Session Service Facade (Complete Unit Coverage)", () => {
    let mockSessionRepo, mockEscrowRepo, mockLogger, service;

    beforeEach(() => {
        mockSessionRepo = { dummyRepo: true };
        mockEscrowRepo = { dummyEscrow: true };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

        // Passes all positional parameters required by the assembler factory layer
        service = createSessionService(mockSessionRepo, mockEscrowRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    it("should correctly compile and expose all slot mutation read and write operations", () => {
        expect(service.getSlots).toBe(mockSlotMutation.getSlots);
        expect(service.getMentorAvailability).toBe(mockSlotMutation.getMentorAvailability);
        expect(service.setMeetingLink).toBe(mockSlotMutation.setMeetingLink);
        expect(service.addSlot).toBe(mockSlotMutation.addSlot);
        expect(service.cancelSlot).toBe(mockSlotMutation.cancelSlot);
        expect(service.rescheduleSlot).toBe(mockSlotMutation.rescheduleSlot);
    });

    it("should correctly compile and expose transaction escrow completion surfaces", () => {
        expect(service.markSlotComplete).toBe(mockCompletion.markSlotComplete);
    });
});