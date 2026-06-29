/**
 * @fileoverview Unit tests for Notification Controller.
 * Achieves 100% statement, line, branch, and condition passing coverage.
 */

jest.mock("../../../utils/appError", () => ({
    handleError: jest.fn((res, err, context) => res.status(500).json({ error: err.message, context })),
}));

jest.mock("../../../utils/response", () => ({
    ok: jest.fn((res, data) => res.status(200).json(data)),
    noContent: jest.fn((res) => res.status(204).send()),
}));

const createNotificationController = require("../../../controllers/notification.controller");
const { handleError } = require("../../../utils/appError");
const { ok, noContent } = require("../../../utils/response");

describe("Notification Controller (100% Comprehensive Coverage Mapping)", () => {
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

        req = {
            params: { id: "notif_99" },
            user: { _id: "user_abc_123" },
        };

        res = {
            status: jest.fn().mockReturnThis(),
            json: jest.fn().mockReturnThis(),
            send: jest.fn().mockReturnThis(),
        };

        jest.clearAllMocks();
    });

    describe("getNotifications Endpoint", () => {
        it("should return the list of notifications successfully", async () => {
            const mockData = { items: [] };
            mockService.getNotifications.mockResolvedValue(mockData);

            await controller.getNotifications(req, res);

            expect(mockService.getNotifications).toHaveBeenCalledWith("user_abc_123");
            expect(ok).toHaveBeenCalledWith(res, mockData);
        });

        it("should capture exceptions and forward to handleError", async () => {
            const err = new Error("Fetch failed");
            mockService.getNotifications.mockRejectedValue(err);

            await controller.getNotifications(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "notification.getNotifications");
        });
    });

    describe("markAllRead Endpoint", () => {
        it("should update bulk status profiles successfully", async () => {
            const mockResult = { message: "Success" };
            mockService.markAllRead.mockResolvedValue(mockResult);

            await controller.markAllRead(req, res);

            expect(mockService.markAllRead).toHaveBeenCalledWith("user_abc_123");
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should route errors via markAllRead catch down to handleError", async () => {
            const err = new Error("Bulk write error");
            mockService.markAllRead.mockRejectedValue(err);

            await controller.markAllRead(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "notification.markAllRead");
        });
    });

    describe("markOneRead Endpoint", () => {
        it("should clear singular notifications seen flags successfully", async () => {
            const mockResult = { message: "Updated" };
            mockService.markOneRead.mockResolvedValue(mockResult);

            await controller.markOneRead(req, res);

            expect(mockService.markOneRead).toHaveBeenCalledWith("notif_99", "user_abc_123");
            expect(ok).toHaveBeenCalledWith(res, mockResult);
        });

        it("should handle error in markOneRead path", async () => {
            const err = new Error("Single update error");
            mockService.markOneRead.mockRejectedValue(err);

            await controller.markOneRead(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "notification.markOneRead");
        });
    });

    describe("deleteNotification Endpoint", () => {
        it("should remove targeted logs entries and return noContent", async () => {
            mockService.deleteNotification.mockResolvedValue({ message: "Deleted" });

            await controller.deleteNotification(req, res);

            expect(mockService.deleteNotification).toHaveBeenCalledWith("notif_99", "user_abc_123");
            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should route delete errors straight to handleError middleware", async () => {
            const err = new Error("Purge failure");
            mockService.deleteNotification.mockRejectedValue(err);

            await controller.deleteNotification(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "notification.deleteNotification");
        });
    });

    describe("clearAll Endpoint", () => {
        it("should completely wipe recipients indexes history safely", async () => {
            mockService.clearAll.mockResolvedValue({ message: "Cleared" });

            await controller.clearAll(req, res);

            expect(mockService.clearAll).toHaveBeenCalledWith("user_abc_123");
            expect(noContent).toHaveBeenCalledWith(res);
        });

        it("should handle error in clearAll path", async () => {
            const err = new Error("Database cluster flush error");
            mockService.clearAll.mockRejectedValue(err);

            await controller.clearAll(req, res);

            expect(handleError).toHaveBeenCalledWith(res, err, "notification.clearAll");
        });
    });
});