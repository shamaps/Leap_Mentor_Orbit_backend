jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json({ success: true, data })),
    noContent: jest.fn((res) => res.status(204).send()),
}));

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(err.status || 500).json({ success: false, error: err.message, context })),
}));

const createNotificationController = require("../../../controllers/notification.controller");
const { ok, noContent } = require("../../../utils/response");
const { handleError } = require("../../../utils/appError");

describe("Notification Controller (Unit)", () => {
    let mockService, mockLogger, controller, req, res;

    beforeEach(() => {
        mockService = {
            getNotifications: jest.fn(),
            markAllRead: jest.fn(),
            markOneRead: jest.fn(),
            deleteNotification: jest.fn(),
            clearAll: jest.fn(),
        };
        mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
        controller = createNotificationController(mockService, { logger: mockLogger });

        req = { user: { _id: "user_recipient_xyz" }, params: {}, body: {} };
        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
    });

    describe("getNotifications", () => {
        it("should fetch feed profiles and return them wrapped in an absolute ok status 200 payload", async () => {
            const serviceResult = { notifications: [] };
            mockService.getNotifications.mockResolvedValue(serviceResult);

            await controller.getNotifications(req, res);

            expect(mockService.getNotifications).toHaveBeenCalledWith("user_recipient_xyz");
            expect(ok).toHaveBeenCalledWith(res, serviceResult);
        });

        it("should seamlessly capture service execution errors and map them to global handlers", async () => {
            const error = new Error("Feed parsing fault");
            mockService.getNotifications.mockRejectedValue(error);

            await controller.getNotifications(req, res);

            expect(handleError).toHaveBeenCalledWith(res, error, "notification.getNotifications");
        });
    });

    describe("deleteNotification", () => {
        it("should target specific notification parameters paths and conclude with noContent status 204 wrappers", async () => {
            req.params.id = "notification_id_777";
            mockService.deleteNotification.mockResolvedValue({ message: "Notification deleted" });

            await controller.deleteNotification(req, res);

            expect(mockService.deleteNotification).toHaveBeenCalledWith("notification_id_777", "user_recipient_xyz");
            expect(noContent).toHaveBeenCalledWith(res);
        });
    });
});