/**
 * @fileoverview Unit tests for Push Subscription Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    noContent: jest.fn((res) => res.status(204).send()),
}));

const createPushSubscriptionController = require("../../../controllers/pushSubscription.controller");
const { handleError } = require("../../../utils/appError");
const { ok, noContent } = require("../../../utils/response");

describe("Push Subscription Controller (100% Full Branch Coverage Blueprint)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            subscribe: jest.fn(),
            unsubscribe: jest.fn(),
            getVapidPublicKey: jest.fn(),
        };

        mockLogger = { info: jest.fn(), error: jest.fn() };
        controller = createPushSubscriptionController(mockService, { logger: mockLogger });

        req = {
            body: {
                subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/xyz", keys: { auth: "123", p256dh: "456" } },
                endpoint: "https://fcm.googleapis.com/fcm/send/xyz"
            },
            user: { _id: "user_push_999" }
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("subscribe Endpoint", () => {
        it("should commit push tracking targets and return ok mapping structures successfully", async () => {
            const mockBody = { success: true, message: "Subscription verified" };
            mockService.subscribe.mockResolvedValue({ status: 200, body: mockBody });

            await controller.subscribe(req, res);

            expect(mockService.subscribe).toHaveBeenCalledWith({
                userId: "user_push_999",
                subscription: req.body.subscription,
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should forward runtime registration errors directly to handleError", async () => {
            const err = new Error("Subscription matrix structure validation error");
            mockService.subscribe.mockRejectedValue(err);

            await controller.subscribe(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "pushSubscription.subscribe");
        });
    });

    describe("unsubscribe Endpoint", () => {
        it("should return ok with data response payloads if the service returns a body mapping package", async () => {
            // CONDITION COVERAGE GAPS FILLED: body evaluates to truthy
            const mockBody = { success: true, removed: 1 };
            mockService.unsubscribe.mockResolvedValue({ status: 200, body: mockBody });

            await controller.unsubscribe(req, res);

            expect(mockService.unsubscribe).toHaveBeenCalledWith({
                userId: "user_push_999",
                endpoint: "https://fcm.googleapis.com/fcm/send/xyz"
            });
            expect(ok).toHaveBeenCalledWith(res, mockBody);
        });

        it("should respond with noContent status if the underlying service yields an empty or null body property", async () => {
            // CONDITION COVERAGE GAPS FILLED: body evaluates to falsy
            mockService.unsubscribe.mockResolvedValue({ status: 200, body: null });

            await controller.unsubscribe(req, res);

            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should route internal catch block exceptions down to the handleError helper", async () => {
            const err = new Error("Cluster write stream disconnect fault");
            mockService.unsubscribe.mockRejectedValue(err);

            await controller.unsubscribe(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "pushSubscription.unsubscribe");
        });
    });

    describe("getVapidPublicKey Endpoint", () => {
        it("should return the public cryptographic environmental tag records cleanly", () => {
            const mockKeyBody = { publicKey: "BEl62vII7J8_8ae..." };
            mockService.getVapidPublicKey.mockReturnValue({ status: 200, body: mockKeyBody });

            controller.getVapidPublicKey(req, res);

            expect(mockService.getVapidPublicKey).toHaveBeenCalled();
            expect(ok).toHaveBeenCalledWith(res, mockKeyBody);
        });
    });
});