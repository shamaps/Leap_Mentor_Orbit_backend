const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockCreateProfileMiddleware = jest.fn((req, res) => res.status(201).json({ success: true, data: {} }));
const mockUpdateProfileMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: {} }));

jest.mock("../../../config/container", () => ({
    mentorProfileController: {
        createProfile: (req, res, next) => mockCreateProfileMiddleware(req, res, next),
        updateProfile: (req, res, next) => mockUpdateProfileMiddleware(req, res, next),
        getMyProfile: jest.fn(),
        getPublicProfile: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "mentor_sandbox_user_ctx" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Mentor Profile Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const mentorProfileRoutes = require("../../../routes/mentorProfile.routes");
        app.use("/mentor-profile", mentorProfileRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /mentor-profile should process schema validation parameters and proceed forward smoothly", async () => {
        await request(app)
            .post("/mentor-profile")
            .send({
                currentRole: "Principal SRE",
                industry: "Cloud Infrastructure",
                yearsOfExperience: 12,
                hourlyRate: 45,
                communicationPreferences: ["Video Call", "Chat"],
            })
            .expect(201);

        expect(mockCreateProfileMiddleware).toHaveBeenCalled();
    });

    it("POST /mentor-profile should throw bad request status 400 if validation ranges are exceeded", async () => {
        await request(app)
            .post("/mentor-profile")
            .send({
                yearsOfExperience: 150, // breaks schema maximum limit constraint (60)
            })
            .expect(400);

        expect(mockCreateProfileMiddleware).not.toHaveBeenCalled();
    });
});