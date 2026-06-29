/**
 * @fileoverview Integration verification tests mapping access controllers over Express route pipelines.
 */

const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockService = {
    getMyAvailability: jest.fn().mockResolvedValue({ timezone: "UTC" }),
    createAvailability: jest.fn().mockResolvedValue({}),
    updateAvailability: jest.fn().mockResolvedValue({}),
    getMentorAvailability: jest.fn().mockResolvedValue({}),
    deleteAvailability: jest.fn().mockResolvedValue(),
    getAvailableSlots: jest.fn().mockResolvedValue([]),
};

const mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
const createAvailabilityController = require("../../../controllers/availability.controller");
const mockController = createAvailabilityController(mockService, { logger: mockLogger });

jest.mock("../../../config/container", () => ({
    availabilityController: mockController,
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "mentor_abc_123" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

const availabilityRoutes = require("../../../routes/availability.routes");

const app = express();
app.use(express.json());
app.use("/availability", availabilityRoutes);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => await dbHandler.clear());
afterAll(async () => await dbHandler.close());

describe("Availability Routes Infrastructure Protocols (Integration)", () => {
    it("GET /availability/me should cleanly route through passport layers returning status data", async () => {
        const response = await request(app)
            .get("/availability/me")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(response.body.data.timezone).toBe("UTC");
    });

    it("POST /availability should reject requests that violate the Joi input schema specification parameters", async () => {
        await request(app)
            .post("/availability")
            .send({ timezone: "" }) // drops required specificDates fields arrays
            .expect(400);
    });
});