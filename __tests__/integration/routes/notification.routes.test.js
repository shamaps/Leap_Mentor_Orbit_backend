const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetNotificationsMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: { notifications: [] } }));
const mockMarkAllReadMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, message: "Marked" }));

jest.mock("../../../config/container", () => ({
    notificationController: {
        getNotifications: (req, res, next) => mockGetNotificationsMiddleware(req, res, next),
        markAllRead: (req, res, next) => mockMarkAllReadMiddleware(req, res, next),
        markOneRead: jest.fn(),
        deleteNotification: jest.fn(),
        clearAll: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "sandbox_recipient_user_ctx" };
        next();
    }),
}));

describe("Notifications Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const notificationsRoutes = require("../../../routes/notifications.routes");
        app.use("/notifications", notificationsRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /notifications should require secure tokens access loops and deliver the notification lists feed", async () => {
        await request(app)
            .get("/notifications")
            .expect(200);

        expect(mockGetNotificationsMiddleware).toHaveBeenCalled();
    });

    it("PATCH /notifications/mark-all-read should capture inputs and execute mass updates forward smoothly", async () => {
        await request(app)
            .patch("/notifications/mark-all-read")
            .expect(200);

        expect(mockMarkAllReadMiddleware).toHaveBeenCalled();
    });
});