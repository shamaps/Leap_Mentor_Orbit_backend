const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

// 1. Create clean, isolated Express middleware mocks for the routes to bind to directly
const mockGetCommissionRateMiddleware = jest.fn((req, res) => {
    return res.status(200).json({ success: true, data: { commissionRate: 10 } });
});

const mockPayMiddleware = jest.fn((req, res) => {
    return res.status(201).json({ success: true, data: { totalAmount: 110 } });
});

// 2. Mock the container so that destructuring variables map to these route runners instantly
jest.mock("../../../config/container", () => ({
    escrowController: {
        getCommissionRate: (req, res, next) => mockGetCommissionRateMiddleware(req, res, next),
        pay: (req, res, next) => mockPayMiddleware(req, res, next),
        release: jest.fn(),
        refund: jest.fn(),
        getStatus: jest.fn(),
        getMyWallet: jest.fn(),
        payAdditional: jest.fn()
    }
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_route_sandbox_id" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Escrow Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();

        app = express();
        app.use(express.json());

        // Load routes now that container definitions are frozen
        const escrowRoutes = require("../../../routes/escrow.routes");
        app.use("/escrow", escrowRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /escrow/commission-rate should safely resolve unauthenticated open parameter queries", async () => {
        const response = await request(app)
            .get("/escrow/commission-rate")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data).toHaveProperty("commissionRate", 10);
        expect(mockGetCommissionRateMiddleware).toHaveBeenCalled();
    });

    it("POST /escrow/pay should catch Joi schematic exceptions before entering core pipeline paths", async () => {
        await request(app)
            .post("/escrow/pay")
            .send({ connectRequestId: "invalid_id_format" })
            .expect(400);
    });
});