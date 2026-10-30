/**
 * @fileoverview Integration tests for the Admin Engagements routes.
 * Real router, real controller, mocked service and mocked admin auth.
 */

const request = require("supertest");
const express = require("express");

const mockService = {
    fetchEngagementStats: jest.fn().mockResolvedValue({ pending: 1, total: 1 }),
    fetchEngagements: jest.fn().mockResolvedValue({ engagements: [], pagination: { total: 0 } }),
};

jest.mock("../../../src/config/container", () => {
    const createAdminEngagementsController = require("../../../src/controllers/admin/adminEngagements.controller");
    return {
        adminEngagementsController: createAdminEngagementsController(mockService, {
            logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
        }),
    };
});

const mockAdminAuthenticate = jest.fn((req, res, next) => {
    req.admin = { _id: "admin_1" };
    next();
});
jest.mock("@leapmentor/shared/middleware/adminAuth", () => ({
    adminAuthenticate: (req, res, next) => mockAdminAuthenticate(req, res, next),
}));

const adminEngagementsRoutes = require("../../../src/routes/adminEngagements.routes");

const app = express();
app.use(express.json());
app.use("/admin/engagements", adminEngagementsRoutes);

describe("Admin Engagements Routes (Integration)", () => {
    afterEach(() => jest.clearAllMocks());

    it("GET /admin/engagements/stats returns the status counts", async () => {
        const res = await request(app).get("/admin/engagements/stats").expect(200);

        expect(res.body).toMatchObject({ success: true, data: { pending: 1, total: 1 } });
        expect(mockAdminAuthenticate).toHaveBeenCalled();
    });

    it("GET /admin/engagements passes the query string through as filter options", async () => {
        await request(app).get("/admin/engagements").query({ status: "ongoing", search: "Jane", page: "2" }).expect(200);

        expect(mockService.fetchEngagements).toHaveBeenCalledWith({ status: "ongoing", search: "Jane", page: "2" });
    });

    it("blocks every route before the controller when admin authentication fails", async () => {
        mockAdminAuthenticate.mockImplementation((req, res) => res.status(401).json({ success: false }));

        await request(app).get("/admin/engagements/stats").expect(401);
        await request(app).get("/admin/engagements").expect(401);

        expect(mockService.fetchEngagementStats).not.toHaveBeenCalled();
        expect(mockService.fetchEngagements).not.toHaveBeenCalled();
    });

    it("answers a service failure with an error response instead of crashing", async () => {
        mockAdminAuthenticate.mockImplementation((req, res, next) => next());
        mockService.fetchEngagementStats.mockRejectedValueOnce(new Error("boom"));

        const res = await request(app).get("/admin/engagements/stats");

        expect(res.status).toBeGreaterThanOrEqual(500);
        expect(res.body.success).toBe(false);
    });

    it("does not expose write methods", async () => {
        mockAdminAuthenticate.mockImplementation((req, res, next) => next());
        await request(app).post("/admin/engagements").send({}).expect(404);
        await request(app).delete("/admin/engagements/stats").expect(404);
    });
});
