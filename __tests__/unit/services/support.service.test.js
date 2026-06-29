/**
 * @fileoverview Unit tests for Support Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/emails", () => ({
    sendSupportResolvedEmail: jest.fn().mockReturnValue(Promise.resolve()),
}));

jest.mock("../../../utils/mappers/support.mapper", () => ({
    toSupportMessageDTO: jest.fn((msg) => ({ success: true, data: msg })),
    toSupportListDTO: jest.fn((data) => data),
}));

const createSupportService = require("../../../services/support.service");
const { sendSupportResolvedEmail } = require("../../../utils/emails");
const { toSupportMessageDTO, toSupportListDTO } = require("../../../utils/mappers/support.mapper");

describe("Support Service Layer (100% Comprehensive Condition Sweep Blueprint)", () => {
    let mockRepo, mockLogger, service, defaultPayload;

    beforeEach(() => {
        mockRepo = {
            createSupportMessage: jest.fn(),
            findAllMessages: jest.fn(),
            countMessages: jest.fn(),
            resolveMessageById: jest.fn(),
            findUserByEmail: jest.fn(),
            createNotification: jest.fn(),
        };

        mockLogger = { info: jest.fn(), warn: jest.fn() };
        service = createSupportService(mockRepo, { logger: mockLogger });

        defaultPayload = {
            email: "support.client@test.com",
            subject: "Payment Portal Verification Error",
            message: "Unable to complete token escrow withdrawal requests.",
            role: "mentee",
        };

        jest.clearAllMocks();
    });

    describe("createMessage Workflows", () => {
        it("should return a 400 response status if mandatory fields parameters evaluate falsy", async () => {
            // CONDITION COVERAGE: !email || !subject || !message
            const res = await service.createMessage({ ...defaultPayload, subject: "" });
            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(mockRepo.createSupportMessage).not.toHaveBeenCalled();
        });

        it("should map default role designation fallbacks cleanly if omitted from request args", async () => {
            // CONDITION COVERAGE: role: role || "user" fallback branch
            mockRepo.createSupportMessage.mockResolvedValue({ _id: "msg_01", status: "open" });

            const payloadWithoutRole = { ...defaultPayload, role: undefined };
            const res = await service.createMessage(payloadWithoutRole);

            expect(res.status).toBe(201);
            expect(mockRepo.createSupportMessage).toHaveBeenCalledWith(expect.objectContaining({
                role: "user"
            }));
            expect(toSupportMessageDTO).toHaveBeenCalled();
        });
    });

    describe("getMessages Workflows", () => {
        it("should apply strict logic clamps and handle parsing string parameters values defaults", async () => {
            // CONDITION COVERAGE: Number.parseInt(x) || fallbacks, Math.max/min extreme bounds clamping evaluation
            mockRepo.findAllMessages.mockResolvedValue([{ _id: "m1" }]);
            mockRepo.countMessages.mockResolvedValue(10);

            // Trigger safePage clamping via negative value and limit clamping via excessive value
            const res = await service.getMessages({ page: "-5", limit: "999" });

            expect(res.status).toBe(200);
            expect(mockRepo.findAllMessages).toHaveBeenCalledWith(0, 100); // page=1 (skip=0), limit clamped to 100
            expect(toSupportListDTO).toHaveBeenCalledWith(expect.objectContaining({
                pagination: { page: 1, limit: 100, total: 10, pages: 1 }
            }));
        });

        it("should handle structural missing parameter objects and gracefully fall back across defaults entirely", async () => {
            // CONDITION COVERAGE: options = {} default assignments, page = 1, limit = 50 fallbacks
            mockRepo.findAllMessages.mockResolvedValue([]);
            mockRepo.countMessages.mockResolvedValue(0);

            const res = await service.getMessages(undefined); // Hits top level function block argument fallback

            expect(res.status).toBe(200);
            expect(mockRepo.findAllMessages).toHaveBeenCalledWith(0, 50);
        });

        it("should evaluate logical OR operators fallback routes when values resolve to unparseable NaN fields", async () => {
            // CONDITION COVERAGE: page and limit parsed as NaN, evaluating to default fallbacks 1 and 50
            mockRepo.findAllMessages.mockResolvedValue([]);
            mockRepo.countMessages.mockResolvedValue(0);

            await service.getMessages({ page: "not-a-number", limit: "invalid-string" });

            expect(mockRepo.findAllMessages).toHaveBeenCalledWith(0, 50);
        });
    });

    describe("resolveMessage Workflows", () => {
        it("should return a 404 response if lookups resolve no matching support rows", async () => {
            // CONDITION COVERAGE: !msg evaluates to true
            mockRepo.resolveMessageById.mockResolvedValue(null);

            const res = await service.resolveMessage("msg_absent");
            expect(res.status).toBe(404);
            expect(res.body.success).toBe(false);
        });

        it("should dispatch internal system notifications and emails if a corresponding user document matches", async () => {
            // CONDITION COVERAGE: user condition is true, email triggers successfully
            const mockMsg = { email: "verified@user.com", subject: "Bug Trace" };
            mockRepo.resolveMessageById.mockResolvedValue(mockMsg);
            mockRepo.findUserByEmail.mockResolvedValue({ _id: "recipient_user_uuid_77" });

            const res = await service.resolveMessage("msg_id");

            expect(res.status).toBe(200);
            expect(mockRepo.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                recipient: "recipient_user_uuid_77",
                type: "support_resolved"
            }));
            expect(sendSupportResolvedEmail).toHaveBeenCalledWith({ toEmail: "verified@user.com", subject: "Bug Trace" });
        });

        it("should skip real-time notification dispatches if email lookup queries yield zero record intersections", async () => {
            // CONDITION COVERAGE: user condition is false
            const mockMsg = { email: "anonymous@visitor.com", subject: "General Info Request" };
            mockRepo.resolveMessageById.mockResolvedValue(mockMsg);
            mockRepo.findUserByEmail.mockResolvedValue(null);

            const res = await service.resolveMessage("msg_id");

            expect(res.status).toBe(200);
            expect(mockRepo.createNotification).not.toHaveBeenCalled();
            expect(sendSupportResolvedEmail).toHaveBeenCalled();
        });

        it("should trace mailing failure warnings inside background non-blocking promise loops catches", async () => {
            // CONDITION COVERAGE: .catch((emailErr) => logger.warn(...)) path execution
            const mockMsg = { email: "error@client.com", subject: "Timeout Exception" };
            mockRepo.resolveMessageById.mockResolvedValue(mockMsg);
            mockRepo.findUserByEmail.mockResolvedValue(null);

            sendSupportResolvedEmail.mockReturnValueOnce(Promise.reject(new Error("Mailing Relays Timeout Block")));

            await service.resolveMessage("msg_id");

            // Allow the macro-task micro-tick event chain sequence loop to flush entirely
            await new Promise(resolve => setImmediate(resolve));
            expect(mockLogger.warn).toHaveBeenCalledWith("Support resolved email failed", expect.objectContaining({
                error: "Mailing Relays Timeout Block"
            }));
        });
    });
});