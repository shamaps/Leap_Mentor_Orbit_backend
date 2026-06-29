const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockSearchMentorsMiddleware = jest.fn((req, res) => {
    return res.status(200).json({ success: true, mentors: [], pagination: {} });
});

jest.mock("../../../config/container", () => ({
    mentorSearchController: {
        searchMentors: (req, res, next) => mockSearchMentorsMiddleware(req, res, next),
        autocompleteMentors: jest.fn(),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "mentee_sandbox_searcher_id" };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
}));

describe("Mentor Search Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const mentorSearchRoutes = require("../../../routes/mentorSearch.routes");
        app.use("/mentors", mentorSearchRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /mentors/search should execute verification guards checkpoints and route operations successfully", async () => {
        await request(app)
            .get("/mentors/search?q=react&industry=Fintech&page=1&limit=10")
            .expect(200);

        expect(mockSearchMentorsMiddleware).toHaveBeenCalled();
    });

    it("GET /mentors/search should trigger a status 400 validation breach error if field parameters violate sizing boundaries", async () => {
        const hyperExtendedQuery = "a".repeat(150); // Fails max(100) boundary limits constraints

        await request(app)
            .get(`/mentors/search?q=${hyperExtendedQuery}`)
            .expect(400);

        expect(mockSearchMentorsMiddleware).not.toHaveBeenCalled();
    });
});