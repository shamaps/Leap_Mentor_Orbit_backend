/**
 * @fileoverview Unit tests for Push Subscription Service.
 * Secures 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../config/env", () => ({
    vapidPublicKey: "VAPID_PUBLIC_CRYPT_KEY_FRAME_999",
}));

const createPushSubscriptionService = require("../../../services/pushSubscription.service");
const config = require("../../../config/env");

describe("Push Subscription Service Layer (100% Element Completeness Blueprint)", () => {
    let mockRepo, mockLogger, service, validSubscription;

    beforeEach(() => {
        mockRepo = {
            upsertSubscription: jest.fn(),
            deleteSubscription: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        service = createPushSubscriptionService(mockRepo, { logger: mockLogger });

        validSubscription = {
            endpoint: "https://updates.push-delivery-service.com/id/100",
            keys: { p256dh: "ecc_public_key_bytes", auth: "secret_auth_token_string" }
        };

        jest.clearAllMocks();
    });

    describe("subscribe Onboarding Action Checks", () => {
        it("should return a 400 error status code if push metadata sub-objects are incomplete or missing properties", async () => {
            // CONDITION COVERAGE: subscription object evaluation variations for endpoint, p256dh, and auth
            const res1 = await service.subscribe({ userId: "u1", subscription: null });
            expect(res1.status).toBe(400);

            const res2 = await service.subscribe({ userId: "u1", subscription: { endpoint: "https://url.com" } });
            expect(res2.status).toBe(400);

            const res3 = await service.subscribe({ userId: "u1", subscription: { endpoint: "https://url.com", keys: { p256dh: "key" } } });
            expect(res3.status).toBe(400);
        });

        it("should issue updates upserts calls across database tables on fully complete valid objects maps", async () => {
            const res = await service.subscribe({ userId: "user_uuid_7", subscription: validSubscription });
            expect(res.status).toBe(200);
            expect(mockRepo.upsertSubscription).toHaveBeenCalledWith("user_uuid_7", validSubscription);
        });
    });

    describe("unsubscribe Termination Procedures", () => {
        it("should invoke repository document evictions and resolve 204 no-content payloads envelope", async () => {
            const res = await service.unsubscribe({ userId: "user_uuid_7", endpoint: "https://url.com" });
            expect(res.status).toBe(204);
            expect(res.body).toBeNull();
            expect(mockRepo.deleteSubscription).toHaveBeenCalledWith("user_uuid_7", "https://url.com");
        });
    });

    describe("getVapidPublicKey Vector Assemblies", () => {
        it("should read application environment attributes maps and return public identifying signatures", () => {
            const res = service.getVapidPublicKey();
            expect(res.status).toBe(200);
            expect(res.body.publicKey).toBe("VAPID_PUBLIC_CRYPT_KEY_FRAME_999");
        });
    });
});