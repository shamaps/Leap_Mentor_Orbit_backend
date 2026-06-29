const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockCreateProfileMiddleware = jest.fn((req, res) => res.status(201).json({ success: true, data: {} }));
const mockGetMyProfileMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: {} }));

jest.mock("../../../config/container", () => ({
    menteeProfileController: {
        createProfile: (req, res, next) => mockCreateProfileMiddleware(req, res, next),
        getMyProfile: (req, res, next) => mockGetMyProfileMiddleware(req, res, next),
        updateProfile: jest.fn(),
        getPublicProfile: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_mentee_sandbox_ctx" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Mentee Profile Routing Pipelines (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const menteeProfileRoutes = require("../../../routes/menteeProfile.routes");
        app.use("/mentee-profile", menteeProfileRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /mentee-profile should accept structured configurations body matching validation parameters schema bounds", async () => {
        await request(app)
            .post("/mentee-profile")
            .send({
                currentRole: "Engineering Manager",
                industry: "Fintech",
                communicationPreferences: ["Chat", "Video Call"],
            })
            .expect(201);

        expect(mockCreateProfileMiddleware).toHaveBeenCalled();
    });

    it("POST /mentee-profile should reject invalid enum parameter options during schema parsing evaluation pass", async () => {
        await request(app)
            .post("/mentee-profile")
            .send({
                communicationPreferences: ["Telepathy"], // Fails schema enum choices
            })
            .expect(400);

        expect(mockCreateProfileMiddleware).not.toHaveBeenCalled();
    });
});