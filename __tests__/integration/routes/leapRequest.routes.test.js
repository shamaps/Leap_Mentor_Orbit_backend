const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetMyRequestMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: {} }));
const mockCreateRequestMiddleware = jest.fn((req, res) => res.status(201).json({ success: true, data: {} }));

jest.mock("../../../config/container", () => ({
    leapRequestController: {
        getMyRequest: (req, res, next) => mockGetMyRequestMiddleware(req, res, next),
        createRequest: (req, res, next) => mockCreateRequestMiddleware(req, res, next),
        getAllRequests: jest.fn(),
        getPendingCount: jest.fn(),
        approveRequest: jest.fn(),
        rejectRequest: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "mentee_sandbox_actor" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Leap Request Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const leapRequestRoutes = require("../../../routes/leapRequest.routes");
        app.use("/leap-requests", leapRequestRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /leap-requests should evaluate role filters and dispatch parameters successfully", async () => {
        await request(app)
            .post("/leap-requests")
            .send({})
            .expect(201);

        expect(mockCreateRequestMiddleware).toHaveBeenCalled();
    });
});