const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockCreateGoalMiddleware = jest.fn((req, res) => res.status(201).json({ success: true, data: {} }));
const mockGetGoalMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: {} }));

jest.mock("../../../config/container", () => ({
    goalController: {
        createGoal: (req, res, next) => mockCreateGoalMiddleware(req, res, next),
        getGoal: (req, res, next) => mockGetGoalMiddleware(req, res, next),
        updateGoal: jest.fn(),
        addMilestone: jest.fn(),
        updateMilestone: jest.fn(),
        deleteMilestone: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_sandbox_ctx" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Goal Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const goalRoutes = require("../../../routes/goal.routes");
        app.use("/goals", goalRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    // FIXED: Shifted test blocks inside the main describe scope closure 
    it("POST /goals should pass request frames onward if fields satisfy standard schema limits", async () => {
        const validObjectId = "665f1c2e4b1a2c001f8e9a44";

        await request(app)
            .post("/goals")
            .send({
                connectRequestId: validObjectId,
                title: "Achieve cloud scaling proficiency",
            })
            .expect(201);

        expect(mockCreateGoalMiddleware).toHaveBeenCalled();
    });

    it("POST /goals should intercept request scopes via validator blocks if inputs break definitions", async () => {
        await request(app)
            .post("/goals")
            .send({
                connectRequestId: "short_bad_id",
                title: "X",
            })
            .expect(400);

        expect(mockCreateGoalMiddleware).not.toHaveBeenCalled();
    });
});