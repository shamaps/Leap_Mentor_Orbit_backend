const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockCreateMessageMiddleware = jest.fn((req, res) => res.status(200).json({ success: true }));
const mockResolveMessageMiddleware = jest.fn((req, res) => res.status(200).json({ success: true }));

jest.mock("../../../config/container", () => ({
    supportController: {
        createMessage: (req, res, next) => mockCreateMessageMiddleware(req, res, next),
        resolveMessage: (req, res, next) => mockResolveMessageMiddleware(req, res, next),
        getMessages: jest.fn(),
    },
}));

jest.mock("../../../middleware/adminAuth", () => ({
    adminAuthenticate: jest.fn((req, res, next) => next()),
}));

jest.mock("../../../middleware/rateLimiter", () => ({
    supportLimiter: (req, res, next) => next(),
}));

describe("Support Desk Routing Ecosystem (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const supportRoutes = require("../../../routes/support.routes");
        app.use("/support", supportRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /support/messages should evaluate schema boundary layers and pass parameters forward", async () => {
        await request(app)
            .post("/support/messages")
            .send({
                email: "onboard@test.com",
                subject: "Cannot book slots",
                message: "The application UI freezes when clicking lock options.",
            })
            .expect(200);

        expect(mockCreateMessageMiddleware).toHaveBeenCalled();
    });

    it("POST /support/messages should drop requests with status 400 if character lengths fall below threshold constraints", async () => {
        await request(app)
            .post("/support/messages")
            .send({
                email: "bad@test.com",
                subject: "Hi", // breaks validation min(3) limit
                message: "Short", // breaks validation min(10) limit
            })
            .expect(400);

        expect(mockCreateMessageMiddleware).not.toHaveBeenCalled();
    });
});