const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockService = {
    sendRequest: jest.fn().mockResolvedValue({}),
    getMyRequests: jest.fn().mockResolvedValue([]),
};

const mockReferService = { getSimilarMentors: jest.fn().mockResolvedValue([]) };

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const createConnectRequestController = require("../../../controllers/connectRequest.controller");
const mockController = createConnectRequestController(mockService, { logger: mockLogger });

jest.mock("../../../config/container", () => ({
    connectRequestController: mockController,
    mentorReferController: { getSimilarMentors: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })) },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_ctx_1" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

const connectRequestRoutes = require("../../../routes/connectRequest.routes");

const app = express();
app.use(express.json());
app.use("/connect-requests", connectRequestRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Connect Request Routes (Integration)", () => {
    it("GET /connect-requests/my-requests should evaluate auth parameters and return rows safely", async () => {
        const response = await request(app)
            .get("/connect-requests/my-requests")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
    });

    it("GET /connect-requests/:id/similar-mentors should resolve specific endpoints properly before getting swallowed by broad param lookups", async () => {
        await request(app)
            .get("/connect-requests/req_id_sample/similar-mentors")
            .expect(200);
    });
});