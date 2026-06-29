/**
 * @fileoverview End-to-end routing pipeline validation for Admin Payments routing points.
 */

const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockService = {
    fetchPaymentStats: jest.fn().mockResolvedValue({ totalRevenue: 1000 }),
    fetchRevenueChart: jest.fn().mockResolvedValue([]),
    fetchTransactions: jest.fn().mockResolvedValue({ transactions: [], pagination: {} }),
};

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
// FIXED: Adjusted path traversal depth from 4 back to 3 step-backs to map smoothly
const createAdminPaymentsController = require("../../../controllers/admin/adminPayments.controller");
const mockController = createAdminPaymentsController(mockService, { logger: mockLogger });

jest.mock("../../../config/container", () => ({
    adminPaymentsController: mockController,
}));

jest.mock("../../../middleware/adminAuth", () => ({
    adminAuthenticate: jest.fn((req, res, next) => {
        req.admin = { _id: "admin_route_ctx_user" };
        next();
    }),
}));

const adminPaymentsRoutes = require("../../../routes/adminPayments.routes");

const app = express();
app.use(express.json());
app.use("/admin/payments", adminPaymentsRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Payments Route Protocols (Integration)", () => {
    it("GET /admin/payments/stats should route requests smoothly", async () => {
        const response = await request(app)
            .get("/admin/payments/stats")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.totalRevenue).toBe(1000);
    });
});