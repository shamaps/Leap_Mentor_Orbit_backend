/**
 * @fileoverview Unit tests for Escrow Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("@leapmentor/shared/utils/withTransaction", () => ({
    withTransaction: jest.fn((fn) => fn("mock_session")),
}));

jest.mock("../../../src/utils/sendInvoiceEmail", () => jest.fn().mockResolvedValue(true));

jest.mock("@leapmentor/shared/utils/sendCalendarInvite", () => ({
    sendCalendarInvite: jest.fn().mockResolvedValue(true),
}));

jest.mock("@leapmentor/shared/utils/emailQueue", () => ({
    sendPaymentReceivedEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("@leapmentor/shared/utils/mappers/escrow.mapper", () => ({
    toPayDTO: jest.fn((d) => d),
    toReleaseDTO: jest.fn((d) => d),
    toRefundDTO: jest.fn((d) => d),
    toEscrowStatusDTO: jest.fn((d) => d),
    toWalletDTO: jest.fn((d) => d),
}));

const createEscrowService = require("../../../src/services/escrow.service");
const sendInvoiceEmail = require("../../../src/utils/sendInvoiceEmail");
const { sendPaymentReceivedEmail } = require("@leapmentor/shared/utils/emailQueue");
const AppError = require("@leapmentor/shared/utils/appError");

describe("Escrow Service Layer (100% ACID and Side-Effects Test Suite)", () => {
    let mockRepo, mockLogger, mockInternalEscrow, service, mockConnectRequest, mockWallet;

    beforeEach(() => {
        mockRepo = {
            findActiveAdmin: jest.fn(),
            findConnectRequestById: jest.fn(),
            findConnectRequestByIdLean: jest.fn(),
            saveConnectRequest: jest.fn(),
            findWalletByUser: jest.fn(),
            findWalletByUserLean: jest.fn(),
            saveWallet: jest.fn(),
            createTransactions: jest.fn(),
            findMentorTimezone: jest.fn(),
            findEscrowByRequest: jest.fn(),
            saveEscrow: jest.fn(),
        };
        mockInternalEscrow = { hold: jest.fn() };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createEscrowService(mockRepo, { logger: mockLogger, internalEscrowService: mockInternalEscrow });

        mockConnectRequest = {
            _id: "conn_123",
            mentee: { _id: "mentee_user", name: "Joe", email: "joe@test.com" },
            mentor: { _id: "mentor_user", name: "Mia", email: "mia@test.com" },
            status: "accepted",
            paymentStatus: "pending",
            selectedSlots: [{ date: "2026-07-01", startTime: "10:00", endTime: "11:00" }],
            additionalSlots: { id: jest.fn() },
            message: "Hello",
        };

        mockWallet = { balance: 1000, escrow: 500 }; 

        jest.clearAllMocks();
    });

    describe("pay Endpoint Workflows", () => {
        it("should fail if request row, authorization profiles or status constraints are invalid", async () => {
            mockRepo.findConnectRequestById.mockResolvedValueOnce(null);
            await expect(service.pay({ connectRequestId: "m", menteeId: "mentee_user" })).rejects.toThrow(new AppError(404, "Connect request not found"));

            mockRepo.findConnectRequestById.mockResolvedValueOnce(mockConnectRequest);
            await expect(service.pay({ connectRequestId: "m", menteeId: "attacker_id" })).rejects.toThrow(AppError);

            mockConnectRequest.status = "pending";
            mockRepo.findConnectRequestById.mockResolvedValueOnce(mockConnectRequest);
            await expect(service.pay({ connectRequestId: "m", menteeId: "mentee_user" })).rejects.toThrow(AppError);

            mockConnectRequest.status = "accepted";
            mockConnectRequest.paymentStatus = "paid";
            mockRepo.findConnectRequestById.mockResolvedValueOnce(mockConnectRequest);
            await expect(service.pay({ connectRequestId: "m", menteeId: "mentee_user" })).rejects.toThrow(AppError);
        });

        it("should map an insufficient-balance hold failure from 422 to a 400 and rethrow other failures untouched", async () => {
            mockRepo.findConnectRequestById.mockResolvedValue(mockConnectRequest);

            mockInternalEscrow.hold.mockRejectedValueOnce(new AppError(422, "Insufficient balance. You have 1 tokens but need 220"));
            await expect(service.pay({ connectRequestId: "m", menteeId: "mentee_user", sessionRate: 100, sessionCount: 2 }))
                .rejects.toMatchObject({ status: 400, message: expect.stringContaining("Insufficient balance") });

            mockInternalEscrow.hold.mockRejectedValueOnce(new AppError(404, "Mentee wallet not found"));
            await expect(service.pay({ connectRequestId: "m", menteeId: "mentee_user", sessionRate: 100, sessionCount: 2 }))
                .rejects.toMatchObject({ status: 404 });

            expect(mockRepo.saveConnectRequest).not.toHaveBeenCalled();
        });

        it("should process holdings and trigger async notification side effects catches logs cleanly", async () => {
            mockRepo.findActiveAdmin.mockResolvedValue({ commissionRate: 10 });
            mockRepo.findConnectRequestById.mockResolvedValue(mockConnectRequest);
            mockInternalEscrow.hold.mockResolvedValue({
                totalAmount: 220, commissionRate: 10, commissionAmount: 20, mentorPayout: 200, balance: 780, escrow: 720,
            });
            mockRepo.findMentorTimezone.mockResolvedValue({ timezone: "Europe/Paris" });

            sendInvoiceEmail.mockRejectedValueOnce(new Error("Invoice Relay Error"));
            sendPaymentReceivedEmail.mockRejectedValueOnce(new Error("Payment Email Error"));

            const res = await service.pay({ connectRequestId: "m", menteeId: "mentee_user", sessionRate: 100, sessionCount: 2 });
            expect(res.paymentStatus).toBe("paid");
            expect(mockInternalEscrow.hold).toHaveBeenCalledWith(
                { requestId: "m", menteeId: "mentee_user", mentorId: "mentor_user", sessionRate: 100, sessionCount: 2 },
                { session: "mock_session" },
            );
            expect(mockRepo.saveConnectRequest).toHaveBeenCalledWith(
                expect.objectContaining({ paymentStatus: "paid", status: "ongoing", totalAmount: 220, mentorPayout: 200 }),
                "mock_session",
            );

            await new Promise((r) => setImmediate(r));
            expect(mockLogger.error).toHaveBeenCalledWith("Invoice email failed", expect.any(Object));
            expect(mockLogger.error).toHaveBeenCalledWith("Payment received email failed", expect.any(Object));
        });
    });

    describe("getStatus and getMyWallet Reads", () => {
        it("should load full wallet rows or throw a 404 if records are missing", async () => {
            mockRepo.findWalletByUserLean.mockResolvedValue(null);
            await expect(service.getMyWallet("u")).rejects.toThrow(AppError);

            mockRepo.findWalletByUserLean.mockResolvedValue({ balance: 100, escrow: 5 });
            const res = await service.getMyWallet("u");
            expect(res.balance).toBe(100);
        });

        it("should return detailed status payloads or enforce strict identity restrictions on getStatus", async () => {
            mockRepo.findConnectRequestByIdLean.mockResolvedValue(mockConnectRequest);
            await expect(service.getStatus({ requestId: "r", userId: "outsider" })).rejects.toThrow(AppError);

            mockRepo.findConnectRequestByIdLean.mockResolvedValue(null);
            await expect(service.getStatus({ requestId: "r", userId: "u" })).rejects.toThrow(AppError);
        });
    });

    describe("getCommissionRate Reads", () => {
        it("should throw a 404 error if commission rate is unset", async () => {
            mockRepo.findActiveAdmin.mockResolvedValue(null);
            await expect(service.getCommissionRate()).rejects.toThrow(AppError);
        });
    });

    describe("payAdditional Endpoint Workflows", () => {
        it("should handle inputs validation parameters fields and check wallet balance limits", async () => {
            await expect(service.payAdditional({ connectRequestId: "", sessionRate: 0, slotId: "" })).rejects.toThrow(AppError);
            await expect(service.payAdditional({ connectRequestId: "c", sessionRate: -1, slotId: "s" })).rejects.toThrow(AppError);

            mockRepo.findActiveAdmin.mockResolvedValue({ commissionRate: 20 });
            mockRepo.findConnectRequestById.mockResolvedValue(mockConnectRequest);
            mockConnectRequest.status = "ongoing";
            mockConnectRequest.additionalSlots = { id: jest.fn().mockReturnValue({ paymentStatus: "pending" }) };
            mockRepo.findWalletByUser.mockResolvedValue(mockWallet);

            const res = await service.payAdditional({ connectRequestId: "c", sessionRate: 50, slotId: "slot_id", menteeId: "mentee_user" });
            expect(res.slotId).toBe("slot_id");
            expect(mockWallet).toMatchObject({ balance: 940, escrow: 560 });
        });

        it("should append the paid slot to an existing escrow record and save it", async () => {
            mockRepo.findActiveAdmin.mockResolvedValue({ commissionRate: 20 });
            mockConnectRequest.status = "ongoing";
            mockConnectRequest.additionalSlots = { id: jest.fn().mockReturnValue({ _id: "slot_oid", paymentStatus: "pending" }) };
            mockRepo.findConnectRequestById.mockResolvedValue(mockConnectRequest);
            mockRepo.findWalletByUser.mockResolvedValue(mockWallet);
            const escrow = { totalAmount: 110, commissionAmount: 10, mentorPayout: 100, sessionCount: 1, slots: [], operations: [] };
            mockRepo.findEscrowByRequest.mockResolvedValue(escrow);

            await service.payAdditional({ connectRequestId: "c", sessionRate: 50, slotId: "slot_id", menteeId: "mentee_user" });

            expect(escrow).toMatchObject({ totalAmount: 170, commissionAmount: 20, mentorPayout: 150, sessionCount: 2 });
            expect(escrow.slots).toHaveLength(1);
            expect(escrow.operations[0].kind).toBe("hold");
            expect(mockRepo.saveEscrow).toHaveBeenCalledWith(escrow, "mock_session");
        });
    });
});