jest.mock("../../../config/env", () => ({
    vapidPublicKey: "BOb_mocked_vapid_key_hex_value_stream",
}));

const createActualPushService = require("../../../services/pushSubscription.service");

describe("Push Subscription Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            upsertSubscription: jest.fn(),
            deleteSubscription: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createActualPushService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    describe("subscribe", () => {
        it("should gracefully block malformed payloads and return status 400 indicators immediately", async () => {
            const result = await service.subscribe({ userId: "u1", subscription: { endpoint: "only_url" } });

            expect(result.status).toBe(400);
            expect(result.body.message).toBe("Invalid subscription object");
            expect(mockRepo.upsertSubscription).not.toHaveBeenCalled();
        });

        it("should delegate execution properties directly to persistence hooks when fields match required structures", async () => {
            const validSub = { endpoint: "https://updates.com", keys: { auth: "sec", p256dh: "key" } };
            mockRepo.upsertSubscription.mockResolvedValue({});

            const result = await service.subscribe({ userId: "user_ok", subscription: validSub });

            // FIXED: Stripped Jasmine's .withContext() out to use standard Jest assertion matchers safely
            expect(mockRepo.upsertSubscription).toHaveBeenCalledWith("user_ok", validSub);
            expect(result.status).toBe(200);
        });
    });

    describe("getVapidPublicKey", () => {
        it("should pull identification vectors directly out of workspace environment definitions configs", () => {
            const result = service.getVapidPublicKey();

            expect(result.status).toBe(200);
            expect(result.body.publicKey).toBe("BOb_mocked_vapid_key_hex_value_stream");
        });
    });
});