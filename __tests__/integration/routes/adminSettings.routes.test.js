/**
 * @fileoverview End-to-end integration mapping pipeline checks for Admin Settings router boundaries.
 */

const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockService = {
    getOverview: jest.fn().mockResolvedValue({ totalUsers: 10 }),
    changePassword: jest.fn().mockResolvedValue({ message: "Done" }),
    addAdmin: jest.fn().mockResolvedValue({}),
    getCommission: jest.fn().mockResolvedValue({ commissionRate: 20 }),
    updateCommission: jest.fn().mockResolvedValue({}),
};

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const createAdminSettingsController = require("../../../controllers/admin/adminSettings.controller");
const mockController = createAdminSettingsController(mockService, { logger: mockLogger });

jest.mock("../../../config/container", () => ({
    adminSettingsController: mockController,
}));

jest.mock("../../../middleware/adminAuth", () => ({
    adminAuthenticate: jest.fn((req, res, next) => {
        req.admin = { _id: "admin_route_sandbox_user" };
        next();
    }),
}));

const adminSettingsRoutes = require("../../../routes/adminSettings.routes");

const app = express();
app.use(express.json());
app.use("/admin/settings", adminSettingsRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Settings Route protocols (Integration)", () => {
    it("GET /admin/settings/overview should pass across mid-tier middlewares safely", async () => {
        const response = await request(app)
            .get("/admin/settings/overview")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.totalUsers).toBe(10);
    });

    it("PATCH /admin/settings/change-password should automatically fail validation routines if input parameters are missing", async () => {
        await request(app)
            .patch("/admin/settings/change-password")
            .send({ currentPassword: "" }) // Schema triggers validation error immediately
            .expect(400);
    });
});