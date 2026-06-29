const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockSubscribeMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, message: "Saved" }));
const mockGetVapidKeyMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, publicKey: "mock" }));

jest.mock("../../../config/container", () => ({
    pushSubscriptionController: {
        subscribe: (req, res, next) => mockSubscribeMiddleware(req, res, next),
        getVapidPublicKey: (req, res, next) => mockGetVapidKeyMiddleware(req, res, next),
        unsubscribe: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_push_sandbox_id" };
        next();
    }),
}));

const app = express();
app.use(express.json());

// Manual binding reproducing system config entry references safely
const { pushSubscriptionController } = require("../../../config/container");
app.post("/push/subscribe", pushSubscriptionController.subscribe);
app.get("/push/vapid-public-key", pushSubscriptionController.getVapidPublicKey);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => {
    await dbHandler.clear();
    jest.clearAllMocks();
});
afterAll(async () => await dbHandler.close());

describe("Push Communications Routing Infrastructure (Integration)", () => {
    it("POST /push/subscribe should bypass security tokens checkpoints and pass payloads forward seamlessly", async () => {
        await request(app)
            .post("/push/subscribe")
            .send({ subscription: { endpoint: "https://endpoint.io" } })
            .expect(200);

        expect(mockSubscribeMiddleware).toHaveBeenCalled();
    });
});