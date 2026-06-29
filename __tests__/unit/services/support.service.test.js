jest.mock("../../../utils/emails", () => ({
    sendSupportResolvedEmail: jest.fn(() => Promise.resolve()),
}));

jest.mock("../../../utils/mappers/support.mapper", () => ({
    toSupportMessageDTO: jest.fn((msg) => msg),
    toSupportListDTO: jest.fn((data) => data),
}));

const createSupportService = require("../../../services/support.service");
const { sendSupportResolvedEmail } = require("../../../utils/emails");

describe("Support Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            createSupportMessage: jest.fn(),
            findAllMessages: jest.fn(),
            countMessages: jest.fn(),
            resolveMessageById: jest.fn(),
            findUserByEmail: jest.fn(),
            createNotification: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createSupportService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("createMessage", () => {
        it("should return status 400 if required fields parameters are omitted", async () => {
            const result = await service.createMessage({ email: "", subject: "Title", message: "" });
            expect(result.status).toBe(400);
            expect(result.body.message).toBe("All fields are required");
        });

        it("should persist support ticket metrics assigning platform defaults to role structures", async () => {
            mockRepo.createSupportMessage.mockResolvedValue({ email: "guest@test.com", status: "open", role: "user" });

            const result = await service.createMessage({ email: "guest@test.com", subject: "Inquiry", message: "Help please" });

            expect(mockRepo.createSupportMessage).toHaveBeenCalledWith({
                email: "guest@test.com",
                subject: "Inquiry",
                message: "Help please",
                role: "user",
                status: "open",
            });
            expect(result.status).toBe(201);
        });
    });

    describe("resolveMessage", () => {
        it("should dispatch internal database alerts and emails if a corresponding user profile is discovered", async () => {
            mockRepo.resolveMessageById.mockResolvedValue({ id: "t1", email: "user@test.com", subject: "Tech ticket" });
            mockRepo.findUserByEmail.mockResolvedValue({ _id: "user_uid_123" });
            mockRepo.createNotification.mockResolvedValue({});

            const result = await service.resolveMessage("t1");

            expect(mockRepo.createNotification).toHaveBeenCalledWith(expect.objectContaining({
                recipient: "user_uid_123",
                type: "support_resolved",
            }));
            expect(sendSupportResolvedEmail).toHaveBeenCalledWith({ toEmail: "user@test.com", subject: "Tech ticket" });
            expect(result.status).toBe(200);
        });
    });
});