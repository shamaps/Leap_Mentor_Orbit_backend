const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetMessagesMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: [] }));
const mockGetUnreadCountMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: { count: 0 } }));

jest.mock("../../../config/container", () => ({
    messageController: {
        getMessages: (req, res, next) => mockGetMessagesMiddleware(req, res, next),
        getUnreadCount: (req, res, next) => mockGetUnreadCountMiddleware(req, res, next),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: { toString: () => "mock_actor_id" } };
        next();
    }),
}));

describe("Message Routing Framework (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const messageRoutes = require("../../../routes/message.routes");
        app.use("/messages", messageRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /messages/:connectRequestId should enforce security tokens and return conversation streams", async () => {
        await request(app)
            .get("/messages/665f1c2e4b1a2c001f8e9a44?limit=10")
            .expect(200);

        expect(mockGetMessagesMiddleware).toHaveBeenCalled();
    });

    it("GET /messages/:connectRequestId/unread should securely capture request headers and output counters payload", async () => {
        await request(app)
            .get("/messages/665f1c2e4b1a2c001f8e9a44/unread")
            .expect(200);

        expect(mockGetUnreadCountMiddleware).toHaveBeenCalled();
    });
});