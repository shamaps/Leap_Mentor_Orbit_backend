/**
 * @fileoverview Integration tests for the admin Leap Request routes
 * (mounted at /api/v1/admin/leap-requests). Controller and admin auth are mocked.
 */

const request = require("supertest");
const express = require("express");

const mockHandlers = {
    getAllRequests: jest.fn((req, res) => res.json({ success: true, handler: "getAllRequests" })),
    getPendingCount: jest.fn((req, res) => res.json({ success: true, handler: "getPendingCount" })),
    approveRequest: jest.fn((req, res) => res.json({ success: true, handler: "approveRequest", id: req.params.id })),
    rejectRequest: jest.fn((req, res) => res.json({ success: true, handler: "rejectRequest", id: req.params.id })),
};

jest.mock("../../../src/config/container", () => ({
    leapRequestController: {
        getAllRequests: (req, res) => mockHandlers.getAllRequests(req, res),
        getPendingCount: (req, res) => mockHandlers.getPendingCount(req, res),
        approveRequest: (req, res) => mockHandlers.approveRequest(req, res),
        rejectRequest: (req, res) => mockHandlers.rejectRequest(req, res),
    },
}));

const mockAdminAuthenticate = jest.fn((req, res, next) => {
    req.admin = { _id: "admin_1" };
    next();
});
jest.mock("@leapmentor/shared/middleware/adminAuth", () => ({
    adminAuthenticate: (req, res, next) => mockAdminAuthenticate(req, res, next),
}));

const adminLeapRequestsRoutes = require("../../../src/routes/adminLeapRequests.routes");

const app = express();
app.use(express.json());
app.use("/admin/leap-requests", adminLeapRequestsRoutes);

describe("Admin Leap Request Routes (Integration)", () => {
    afterEach(() => {
        jest.clearAllMocks();
        mockAdminAuthenticate.mockImplementation((req, res, next) => { req.admin = { _id: "admin_1" }; next(); });
    });

    it("GET / lists the requests", async () => {
        const res = await request(app).get("/admin/leap-requests").expect(200);
        expect(res.body.handler).toBe("getAllRequests");
    });

    it("GET /pending-count returns the badge count, not a request lookup", async () => {
        const res = await request(app).get("/admin/leap-requests/pending-count").expect(200);
        expect(res.body.handler).toBe("getPendingCount");
    });

    it("PATCH /:id/approve passes the id to the approve handler", async () => {
        const res = await request(app).patch("/admin/leap-requests/req_42/approve").expect(200);
        expect(res.body).toMatchObject({ handler: "approveRequest", id: "req_42" });
    });

    it("PATCH /:id/reject passes the id to the reject handler", async () => {
        const res = await request(app).patch("/admin/leap-requests/req_42/reject").expect(200);
        expect(res.body).toMatchObject({ handler: "rejectRequest", id: "req_42" });
    });

    it("puts admin authentication in front of all four routes", async () => {
        mockAdminAuthenticate.mockImplementation((req, res) => res.status(401).json({ success: false }));

        await request(app).get("/admin/leap-requests").expect(401);
        await request(app).get("/admin/leap-requests/pending-count").expect(401);
        await request(app).patch("/admin/leap-requests/req_42/approve").expect(401);
        await request(app).patch("/admin/leap-requests/req_42/reject").expect(401);

        Object.values(mockHandlers).forEach((handler) => expect(handler).not.toHaveBeenCalled());
    });

    it("does not allow the wrong HTTP method on the approve and reject routes", async () => {
        await request(app).get("/admin/leap-requests/req_42/approve").expect(404);
        await request(app).post("/admin/leap-requests/req_42/reject").expect(404);
        await request(app).post("/admin/leap-requests").send({}).expect(404);
    });
});
