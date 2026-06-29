const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

// Mock handlers directly to avoid dependency tracing pitfalls inside routing configurations
const mockSubmitFeedbackMiddleware = jest.fn((req, res) => {
    return res.status(201).json({ success: true, id: "mocked_feedback" });
});

const mockGetFeedbackMiddleware = jest.fn((req, res) => {
    return res.status(200).json({ success: true, sessionStatus: "completed" });
});

jest.mock("../../../config/container", () => ({
    feedbackController: {
        submitFeedback: (req, res, next) => mockSubmitFeedbackMiddleware(req, res, next),
        getFeedback: (req, res, next) => mockGetFeedbackMiddleware(req, res, next),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_route_sandbox_id" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Feedback Routing Pipelines (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();

        app = express();
        app.use(express.json());

        const feedbackRoutes = require("../../../routes/feedback.routes");
        app.use("/feedback", feedbackRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("POST /feedback should route successfully and support payload additions if schemas pass schema validation checks", async () => {
        // Valid 24-character hexadecimal sequence string pattern
        const mockObjectId = "665f1c2e4b1a2c001f8e9a44";

        const response = await request(app)
            .post("/feedback")
            .send({
                connectRequestId: mockObjectId,
                rating: 5,
                comment: "Flawless instruction",
            })
            .expect(201);

        expect(response.body).toHaveProperty("success", true);
        expect(mockSubmitFeedbackMiddleware).toHaveBeenCalled();
    });

    it("POST /feedback should intercept malformed requests via schema filters before executing controller actions", async () => {
        await request(app)
            .post("/feedback")
            .send({
                connectRequestId: "short_bad_id",
                rating: 99, // Fails schema bounds
            })
            .expect(400);

        expect(mockSubmitFeedbackMiddleware).not.toHaveBeenCalled();
    });
});