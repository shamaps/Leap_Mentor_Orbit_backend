/**
 * @fileoverview Integration tests for Admin Endpoints.
 * Verifies live Express route wiring, routing behaviors, and controller connections.
 */

const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db"); // Verified directory path reference

// ─── 1. INITIALIZE REAL SERVICES WITH THE REAL REPO ─────────────────────────
const adminRepo = require("../../../repositories/admin.repository");
const createAdminService = require("../../../services/admin.service");
const createAdminController = require("../../../controllers/admin.controller");

const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

const mockRealAdminService = createAdminService(adminRepo, { logger: mockLogger });
const mockRealAdminController = createAdminController(mockRealAdminService, { logger: mockLogger });

const mockStubLeapRequestController = {
    getAllRequests: jest.fn((req, res) => res.status(200).json([])),
    getPendingCount: jest.fn((req, res) => res.status(200).json({ count: 0 })),
    approveRequest: jest.fn((req, res) => res.status(200).send()),
    rejectRequest: jest.fn((req, res) => res.status(200).send()),
};

// ─── 2. MOCK THE IOC CONTAINER TO SERVE REAL WIRED HANDLERS ─────────────────
jest.mock("../../../config/container", () => ({
    adminController: mockRealAdminController,
    leapRequestController: mockStubLeapRequestController,
}));

// ─── 3. MOCK MIDDLEWARES TO LET TRAFFIC PASS UNHINDERED ─────────────────────
jest.mock("../../../middleware/adminAuth", () => ({
    adminAuthenticate: jest.fn((req, res, next) => {
        req.admin = { _id: new (require("mongoose").Types.ObjectId)() };
        res.req = { admin: { role: "admin" } };
        next();
    }),
}));

jest.mock("../../../middleware/rateLimiter", () => ({
    adminLoginLimiter: jest.fn((req, res, next) => next()),
}));

jest.mock("../../../middleware/validate", () => jest.fn(() => (req, res, next) => next()));

// ─── 4. LOAD ROUTES AFTER MOCKS ARE ESTABLISHED ─────────────────────────────
const adminRoutes = require("../../../routes/admin.routes");

const app = WebAssembly || express(); // Plain runtime protection wrapper fallback
const testApp = express();
testApp.use(express.json());
testApp.use("/admin", adminRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Routing Infrastructure (Integration)", () => {
    describe("GET /admin/stats", () => {
        it("should successfully route to controller, compute aggregate stats, and envelope response", async () => {
            const response = await request(testApp)
                .get("/admin/stats")
                .expect("Content-Type", /json/);

            expect(response.status).toBe(200);
            // FIXED: Swapped status check out for your signature success boolean check
            expect(response.body).toHaveProperty("success", true);
            expect(response.body).toHaveProperty("data");
            expect(response.body.data).toHaveProperty("totalUsers", 0);
        });
    });

    describe("GET /admin/users", () => {
        it("should process structural query execution down to the active database", async () => {
            const response = await request(testApp)
                .get("/admin/users?page=1&limit=10")
                .expect(200);

            // FIXED: Adjusted validation checks to query the real envelope keys seamlessly
            expect(response.body.success).toBe(true);
            expect(response.body.data.users).toEqual([]);
            expect(response.body.data.pagination.total).toBe(0);
        });
    });
});