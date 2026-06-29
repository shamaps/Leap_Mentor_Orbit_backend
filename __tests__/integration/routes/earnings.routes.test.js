const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockEarningsService = {
    getEarningsSummary: jest.fn().mockResolvedValue({ totalEarnings: 1500 }),
    getEarningsChart: jest.fn().mockResolvedValue({ period: "monthly", data: [] }),
    getPayoutHistory: jest.fn().mockResolvedValue({ payouts: [], pagination: {} }),
};

const mockWithdrawalService = {
    withdrawEarnings: jest.fn().mockResolvedValue({ success: true }),
};

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const createEarningsController = require("../../../controllers/earnings.controller");
const mockController = createEarningsController(mockEarningsService, mockWithdrawalService, { logger: mockLogger });

jest.mock("../../../config/container", () => ({
    earningsController: mockController,
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "mentor_route_test_user_id" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

const earningsRoutes = require("../../../routes/earnings.routes");

const app = express();
app.use(express.json());
app.use("/mentor/earnings", earningsRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Earnings Routes Pipeline (Integration)", () => {
    it("GET /mentor/earnings should return summary object metadata maps under correct permissions", async () => {
        const response = await request(app)
            .get("/mentor/earnings")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.totalEarnings).toBe(1500);
    });

    it("POST /mentor/earnings/withdraw should correctly trigger financial cashout handlers", async () => {
        await request(app)
            .post("/mentor/earnings/withdraw")
            .expect(200);

        expect(mockWithdrawalService.withdrawEarnings).toHaveBeenCalledWith("mentor_route_test_user_id");
    });
});