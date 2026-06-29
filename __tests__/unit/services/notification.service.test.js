jest.mock("../../../utils/mappers/notification.mapper", () => ({
    toNotificationList: jest.fn((list) => list),
}));

const createNotificationService = require("../../../services/notification.service");

describe("Notification Service (Unit)", () => {
    let mockRepo, mockLogger, service;

    beforeEach(() => {
        mockRepo = {
            findNotificationsByUser: jest.fn(),
            markAllReadByUser: jest.fn(),
            markOneReadByUser: jest.fn(),
            deleteOneByUser: jest.fn(),
            deleteAllByUser: jest.fn(),
        };
        mockLogger = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };
        service = createNotificationService(mockRepo, { logger: mockLogger });
        jest.clearAllMocks();
    });

    // ─── getNotifications ────────────────────────────────────────────────────

    describe("getNotifications", () => {
        it("should return notifications list for a valid user", async () => {
            mockRepo.findNotificationsByUser.mockResolvedValue([{ title: "Welcome" }, { title: "Update" }]);

            const result = await service.getNotifications("user_123");

            expect(mockRepo.findNotificationsByUser).toHaveBeenCalledWith("user_123");
            expect(result.notifications).toHaveLength(2);
        });

        it("should return empty array when user has no notifications", async () => {
            mockRepo.findNotificationsByUser.mockResolvedValue([]);

            const result = await service.getNotifications("user_empty");

            expect(result.notifications).toHaveLength(0);
            expect(mockRepo.findNotificationsByUser).toHaveBeenCalledWith("user_empty");
        });

        it("should call debug logger with userId and count", async () => {
            mockRepo.findNotificationsByUser.mockResolvedValue([{ title: "Hello" }]);

            await service.getNotifications("user_abc");

            expect(mockLogger.debug).toHaveBeenCalledWith("getNotifications called", { userId: "user_abc" });
            expect(mockLogger.debug).toHaveBeenCalledWith("Notifications fetched", { count: 1 });
        });

        it("should propagate repository errors", async () => {
            mockRepo.findNotificationsByUser.mockRejectedValue(new Error("DB error"));

            await expect(service.getNotifications("user_123")).rejects.toThrow("DB error");
        });
    });

    // ─── markAllRead ─────────────────────────────────────────────────────────

    describe("markAllRead", () => {
        it("should call markAllReadByUser and return success message", async () => {
            mockRepo.markAllReadByUser.mockResolvedValue({});

            const result = await service.markAllRead("user_123");

            expect(mockRepo.markAllReadByUser).toHaveBeenCalledWith("user_123");
            expect(result.message).toBe("All notifications marked as read");
        });

        it("should propagate repository errors", async () => {
            mockRepo.markAllReadByUser.mockRejectedValue(new Error("DB failure"));

            await expect(service.markAllRead("user_123")).rejects.toThrow("DB failure");
        });
    });

    // ─── markOneRead ─────────────────────────────────────────────────────────

    describe("markOneRead", () => {
        it("should call markOneReadByUser with correct args and return success message", async () => {
            mockRepo.markOneReadByUser.mockResolvedValue({});

            const result = await service.markOneRead("notif_123", "user_123");

            expect(mockRepo.markOneReadByUser).toHaveBeenCalledWith("notif_123", "user_123");
            expect(result.message).toBe("Notification marked as read");
        });

        it("should propagate errors from the repository", async () => {
            mockRepo.markOneReadByUser.mockRejectedValue(new Error("Not found"));

            await expect(service.markOneRead("bad_id", "user_123")).rejects.toThrow("Not found");
        });
    });

    // ─── deleteNotification ──────────────────────────────────────────────────

    describe("deleteNotification", () => {
        it("should call deleteOneByUser with correct args and return success message", async () => {
            mockRepo.deleteOneByUser.mockResolvedValue({});

            const result = await service.deleteNotification("notif_456", "user_123");

            expect(mockRepo.deleteOneByUser).toHaveBeenCalledWith("notif_456", "user_123");
            expect(result.message).toBe("Notification deleted");
        });

        it("should propagate errors from the repository", async () => {
            mockRepo.deleteOneByUser.mockRejectedValue(new Error("Delete failed"));

            await expect(service.deleteNotification("notif_xyz", "user_123")).rejects.toThrow("Delete failed");
        });
    });

    // ─── clearAll ────────────────────────────────────────────────────────────

    describe("clearAll", () => {
        it("should call deleteAllByUser and return success message", async () => {
            mockRepo.deleteAllByUser.mockResolvedValue({});

            const result = await service.clearAll("user_123");

            expect(mockRepo.deleteAllByUser).toHaveBeenCalledWith("user_123");
            expect(result.message).toBe("All notifications cleared");
        });

        it("should propagate errors from the repository", async () => {
            mockRepo.deleteAllByUser.mockRejectedValue(new Error("Clear failed"));

            await expect(service.clearAll("user_123")).rejects.toThrow("Clear failed");
        });
    });
});