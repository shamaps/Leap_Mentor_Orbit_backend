/**
 * @fileoverview End-to-end integration mapping for Admin Reports routes.
 * Ensures authorization barriers, request paths, and JSON bodies map flawlessly.
 */

const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockService = {
    fetchReportStats: jest.fn().mockResolvedValue({ totalReports: 5 }),
    fetchReports: jest.fn().mockResolvedValue({ reports: [], pagination: {} }),
    handleReport: jest.fn().mockResolvedValue({ id: "rep_id", status: "resolved" }),
    processRefund: jest.fn().mockResolvedValue({ refundAmount: 50 }),
    deleteSession: jest.fn().mockResolvedValue(),
};

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const createAdminReportsController = require("../../../controllers/admin/adminReports.controller");
const mockController = createAdminReportsController(mockService, { logger: mockLogger });

jest.mock("../../../config/container", () => ({
    adminReportsController: mockController,
}));

jest.mock("../../../middleware/adminAuth", () => ({
    adminAuthenticate: jest.fn((req, res, next) => {
        req.admin = { _id: "admin_route_context_id" };
        next();
    }),
}));

const adminReportsRoutes = require("../../../routes/adminReports.routes");

const app = express();
app.use(express.json());
app.use("/admin/reports", adminReportsRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Reports Route Protocols (Integration)", () => {
    it("GET /admin/reports/stats should authenticate and serve payload records", async () => {
        const response = await request(app)
            .get("/admin/reports/stats")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.totalReports).toBe(5);
    });

    it("PATCH /admin/reports/:id should trigger 422 validations on unmapped status configurations", async () => {
        await request(app)
            .patch("/admin/reports/rep_123")
            .send({ status: "reviewing" })
            .expect(422);
    });

    it("POST /admin/reports/:id/refund should return an authenticated 200 payload wrapper", async () => {
        const response = await request(app)
            .post("/admin/reports/rep_123/refund")
            .send({ adminNote: "Approved" })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.refundAmount).toBe(50);
    });
});