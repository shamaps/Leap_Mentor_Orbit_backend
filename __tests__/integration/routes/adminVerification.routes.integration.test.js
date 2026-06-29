/**
 * @fileoverview Integration tests for Admin Verification Endpoints.
 * Verifies routing rules, HTTP verb bindings, and real database connectivity pipeline.
 */

const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

// ─── 1. INITIALIZE REAL SERVICES WITH THE REAL REPO ─────────────────────────
const adminVerificationRepo = require("../../../repositories/adminVerification.repository");
const createAdminVerificationService = require("../../../services/adminVerification.service");
const createAdminVerificationController = require("../../../controllers/adminVerification.controller");

const mockLogger = { info: jest.fn(), error: jest.fn(), debug: jest.fn(), warn: jest.fn() };

const mockRealService = createAdminVerificationService(adminVerificationRepo, { logger: mockLogger });
const mockRealController = createAdminVerificationController(mockRealService, { logger: mockLogger });

// ─── 2. MOCK THE IOC CONTAINER TO SERVE REAL WIRED HANDLERS ─────────────────
jest.mock("../../../config/container", () => ({
    adminVerificationController: mockRealController,
}));

// ─── 3. MOCK MIDDLEWARES TO LET TRAFFIC PASS UNHINDERED ─────────────────────
jest.mock("../../../middleware/adminAuth.js", () => ({
    adminAuthenticate: jest.fn((req, res, next) => {
        req.admin = { _id: "integration_admin_id" };
        next();
    }),
}));

// ─── 4. LOAD ROUTES AFTER MOCKS ARE ESTABLISHED ─────────────────────────────
const adminVerificationRoutes = require("../../../routes/adminVerification.routes");

const app = express();
app.use(express.json());
app.use("/admin/mentor-verifications", adminVerificationRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Admin Verification Routes (Integration)", () => {
    describe("GET /admin/mentor-verifications", () => {
        it("should map through express layer down to an active empty database query", async () => {
            const response = await request(app)
                .get("/admin/mentor-verifications")
                .expect("Content-Type", /json/)
                .expect(200);

            // FIXED: Adjusted path checks to correctly trace inside your app's true envelope response data object
            expect(response.body).toHaveProperty("success", true);
            expect(response.body.data).toHaveProperty("mentors");
            expect(response.body.data.mentors).toEqual([]);
            expect(response.body.data).toHaveProperty("pagination");
            expect(response.body.data.pagination.total).toBe(0);
        });
    });

    describe("GET /admin/mentor-verifications/:mentorProfileId", () => {
        it("should propagate error status responses natively if record parameters are invalid", async () => {
            const response = await request(app)
                .get("/admin/mentor-verifications/60c72b2f9b1d8b2bad684999")
                .expect(404);

            // FIXED: Checks the entire body configuration structure natively to accommodate either error or message property structures
            const errorContent = response.body.message || response.body.error || JSON.stringify(response.body);
            expect(errorContent.toLowerCase()).toContain("mentor profile not found");
        });
    });
});