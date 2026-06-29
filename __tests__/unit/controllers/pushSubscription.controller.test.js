jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createPushSubscriptionController = require("../../../controllers/pushSubscription.controller");
const { ok, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Push Subscription Controller (Unit)", () => {
    let mockPushService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockPushService = {
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
            getVapidPublicKey: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createPushSubscriptionController(mockPushService, { logger: mockLogger });

        req = { user: { _id: "user_push_123" }, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("subscribe", () => {
        it("should accept client push configurations, invoke registrations, and wrap response payloads in status 200", async () => {
            req.body.subscription = { endpoint: "https://fcm.googleapis.com/123", keys: { auth: "a", p256dh: "p" } };
            mockPushService.subscribe.mockResolvedValue({ status: 200, body: { message: "Push subscription saved" } });

            await controller.subscribe(req, res);

            expect(mockPushService.subscribe).toHaveBeenCalledWith({
                userId: "user_push_123",
                subscription: req.body.subscription,
            });
            expect(ok).toHaveBeenCalledWith(res, { message: "Push subscription saved" });
        });

        it("should redirect processing exceptions directly into global application error utilities", async () => {
            const error = new Error("Data stream collision");
            mockPushService.subscribe.mockRejectedValue(error);

            await controller.subscribe(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "pushSubscription.subscribe");
        });
    });

    describe("unsubscribe", () => {
        it("should clear specific device nodes and close out streams with standard 204 noContent indicators", async () => {
            req.body.endpoint = "https://fcm.googleapis.com/123";
            mockPushService.unsubscribe.mockResolvedValue({ status: 204, body: null });

            await controller.unsubscribe(req, res);

            expect(mockPushService.unsubscribe).toHaveBeenCalledWith({
                userId: "user_push_123",
                endpoint: "https://fcm.googleapis.com/123",
            });
            expect(noContent).toHaveBeenCalledWith(res);
        });
    });
});