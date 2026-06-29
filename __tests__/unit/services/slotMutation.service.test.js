jest.mock("../../../utils/mappers/session.mapper", () => ({
    toSlotDTO: jest.fn((data) => data),
    toAvailabilityDTO: jest.fn((data) => data),
}));

jest.mock("../../../utils/generateSlots", () => ({
    generateSlotsFromSpecificDates: jest.fn(() => [{ time: "09:00" }]),
}));

jest.mock("../../../utils/emails", () => ({
    sendSlotCancelledEmail: jest.fn().mockResolvedValue({}),
    sendSlotRescheduledEmail: jest.fn().mockResolvedValue({}),
    sendAdditionalSlotEmail: jest.fn().mockResolvedValue({}),
}));

jest.mock("../../../utils/refundSlot", () => jest.fn().mockResolvedValue({
    refundedAmount: 100, balance: 400, escrow: 0
}));

// Mock socket global module explicitly to capture event emission vectors
jest.mock("../../../socket/socketHandler", () => ({
    emitToUser: jest.fn(),
}));

const createSlotMutationService = require("../../../services/slotMutation.service");
const socketHandler = require("../../../socket/socketHandler");
const emails = require("../../../utils/emails");
const AppError = require("../../../utils/appError");

describe("Slot Mutation Service (Complete Unit Coverage)", () => {
    let mockRepo, mockEscrowRepo, mockLogger, service, baseSessionDoc;

    beforeEach(() => {
        mockRepo = {
            findSessionPopulated: jest.fn(),
            findSessionForRead: jest.fn(),
            findSessionDocument: jest.fn(),
            findSessionDocumentWithSession: jest.fn(),
            findMentorAvailability: jest.fn(),
        };
        mockEscrowRepo = { ledgerMutation: jest.fn() };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

        service = createSlotMutationService(mockRepo, mockEscrowRepo, { logger: mockLogger });

        baseSessionDoc = {
            mentor: "mentor_1",
            mentee: "mentee_1",
            status: "ongoing",
            paymentStatus: "pending",
            selectedSlots: [
                { date: "2026-07-06", startTime: "09:00", endTime: "10:00", status: "booked" }
            ],
            additionalSlots: [],
            markModified: jest.fn(), // FIXED: Added missing Mongoose tracking hook mock
            save: jest.fn().mockResolvedValue(true),
        };

        jest.clearAllMocks();
    });

    describe("getSlots", () => {
        it("should fetch, construct progress percentages, and map slots out through standard DTO schemas", async () => {
            mockRepo.findSessionForRead.mockResolvedValue(baseSessionDoc);

            const result = await service.getSlots("s1", "mentor_1");
            expect(result.progress).toBe(0);
            expect(result.slots).toHaveLength(1);
        });
    });

    describe("setMeetingLink", () => {
        it("should throw a 400 AppError if the clear text payload is empty", async () => {
            await expect(service.setMeetingLink({ connectRequestId: "s1", slotIndex: 0, meetingLink: " ", userId: "mentor_1" }))
                .rejects.toThrow(new AppError(400, "meetingLink is required"));
        });

        it("should throw a 400 AppError if the destination parameter target address fails baseline domain patterns filters", async () => {
            await expect(service.setMeetingLink({ connectRequestId: "s1", slotIndex: 0, meetingLink: "https://malicious-domain.com", userId: "mentor_1" }))
                .rejects.toThrow(new AppError(400, "Only links from trusted platforms (Google Meet, Zoom, etc.) are allowed."));
        });

        it("should save the trimmed destination hyperlink and broadcast metrics parameters out over sockets", async () => {
            mockRepo.findSessionDocument.mockResolvedValue(baseSessionDoc);

            const result = await service.setMeetingLink({
                connectRequestId: "s1",
                slotIndex: 0,
                meetingLink: "https://meet.google.com/abc-defg-hij",
                userId: "mentor_1"
            });

            expect(baseSessionDoc.selectedSlots[0].meetingLink).toBe("https://meet.google.com/abc-defg-hij");
            expect(baseSessionDoc.save).toHaveBeenCalled();
            expect(socketHandler.emitToUser).toHaveBeenCalled();
            expect(result.slotIndex).toBe(0);
        });
    });

    describe("addSlot", () => {
        it("should throw a 400 AppError if critical parameter values arrive empty", async () => {
            await expect(service.addSlot("s1", { date: "" }, "mentor_1"))
                .rejects.toThrow(new AppError(400, "date, startTime and endTime are required"));
        });

        it("should throw a 409 AppError if a booking collision strikes an already outstanding active index", async () => {
            mockRepo.findSessionDocument.mockResolvedValue(baseSessionDoc);

            const duplicatePayload = { date: "2026-07-06", startTime: "09:00", endTime: "10:00" };
            await expect(service.addSlot("s1", duplicatePayload, "mentor_1"))
                .rejects.toThrow(new AppError(409, "This slot already exists in the session"));
        });

        it("should write additional slots and log tracking metrics cleanly", async () => {
            mockRepo.findSessionDocument.mockResolvedValue(baseSessionDoc);
            mockRepo.findSessionPopulated.mockResolvedValue({
                mentor: { name: "Bob", email: "bob@test.com" },
                mentee: { name: "Alice", email: "alice@test.com" }
            });

            const validPayload = { date: "2026-07-07", startTime: "14:00", endTime: "15:00" };
            const result = await service.addSlot("s1", validPayload, "mentor_1");

            expect(baseSessionDoc.selectedSlots).toHaveLength(2);
            expect(baseSessionDoc.save).toHaveBeenCalled();

            // Background async mailing thread execution tracking validation guard checklist
            await new Promise((resolve) => setImmediate(resolve));
            expect(emails.sendAdditionalSlotEmail).toHaveBeenCalled();
            expect(result.slot.startTime).toBe("14:00");
        });
    });

    describe("cancelSlot", () => {
        it("should throw a 400 AppError if target indices hold a cancelled status flag", async () => {
            baseSessionDoc.selectedSlots[0].status = "cancelled";
            mockRepo.findSessionDocument.mockResolvedValue(baseSessionDoc);

            await expect(service.cancelSlot({ connectRequestId: "s1", slotIndex: 0, userId: "mentor_1" }))
                .rejects.toThrow(new AppError(400, "This slot is already cancelled"));
        });

        it("should complete cancellation, initiate token refunds if paid, and handle email processing traps gracefully", async () => {
            baseSessionDoc.paymentStatus = "paid";
            mockRepo.findSessionDocument.mockResolvedValue(baseSessionDoc);
            mockRepo.findSessionPopulated.mockRejectedValue(new Error("Mailing down"));

            const result = await service.cancelSlot({ connectRequestId: "s1", slotIndex: 0, userId: "mentor_1", reason: "Emergency" });

            expect(baseSessionDoc.selectedSlots[0].status).toBe("cancelled");
            expect(baseSessionDoc.selectedSlots[0].cancellationReason).toBe("Emergency");
            expect(mockLogger.error).toHaveBeenCalledWith("Notification after populate failed", expect.any(Object));
            expect(result.refund).toEqual({ refundedAmount: 100, newBalance: 400, newEscrow: 0 });
        });
    });

    describe("rescheduleSlot", () => {
        it("should throw a 409 AppError if the requested target schedule replacement overlaps an existing book node", async () => {
            mockRepo.findSessionDocument.mockResolvedValue(baseSessionDoc);

            const collisionBody = { date: "2026-07-06", startTime: "09:00", endTime: "10:00" };
            await expect(service.rescheduleSlot({ connectRequestId: "s1", slotIndex: 0, body: collisionBody, userId: "mentor_1" }))
                .rejects.toThrow(new AppError(409, "The new slot is already booked"));
        });

        it("should mark the historical index as cancelled and seamlessly transition replacement blocks", async () => {
            mockRepo.findSessionDocument.mockResolvedValue(baseSessionDoc);
            mockRepo.findSessionPopulated.mockResolvedValue({ mentor: {}, mentee: {} });

            const validRescheduleBody = { date: "2026-07-08", startTime: "11:00", endTime: "12:00" };
            const result = await service.rescheduleSlot({ connectRequestId: "s1", slotIndex: 0, body: validRescheduleBody, userId: "mentor_1" });

            expect(result.oldSlot.status).toBe("cancelled");
            expect(result.newSlot.status).toBe("booked");
            expect(result.newSlotIndex).toBe(1);
        });
    });

    describe("getMentorAvailability", () => {
        it("should return empty arrays blocks directly if rule definition parameters mapping collections are blank", async () => {
            mockRepo.findSessionForRead.mockResolvedValue(baseSessionDoc);
            mockRepo.findMentorAvailability.mockResolvedValue({ specificDates: [] });

            const result = await service.getMentorAvailability("s1", "mentor_1");
            expect(result.slots).toEqual([]);
        });

        it("should evaluate timelines through specific generation metrics if records match", async () => {
            mockRepo.findSessionForRead.mockResolvedValue(baseSessionDoc);
            mockRepo.findMentorAvailability.mockResolvedValue({
                specificDates: [{ date: "2026-07-20", ranges: [] }],
                timezone: "Asia/Kolkata",
                sessionDurations: [60]
            });

            const result = await service.getMentorAvailability("s1", "mentor_1");
            expect(result.slots).toBeDefined();
        });
    });
});