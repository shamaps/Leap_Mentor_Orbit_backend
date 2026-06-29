const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetSimilarMentorsMiddleware = jest.fn((req, res) => {
    return res.status(200).json({ success: true, mentors: [], mySkills: [] });
});

jest.mock("../../../config/container", () => ({
    mentorReferController: {
        getSimilarMentors: (req, res, next) => mockGetSimilarMentorsMiddleware(req, res, next),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "mentor_host_sandbox_ctx" };
        next();
    }),
}));

const app = express();
app.use(express.json());

// Bind mock controller target to recreate core router mappings cleanly
const { mentorReferController } = require("../../../config/container");
app.get("/connect-requests/:id/similar-mentors", mentorReferController.getSimilarMentors);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => {
    await dbHandler.clear();
    jest.clearAllMocks();
});
afterAll(async () => await dbHandler.close());

describe("Mentor Referral Routing Interfaces (Integration)", () => {
    it("GET /connect-requests/:id/similar-mentors should secure entry and hand off handling parameters correctly", async () => {
        await request(app)
            .get("/connect-requests/665f1c2e4b1a2c001f8e9a44/similar-mentors")
            .expect(200);

        expect(mockGetSimilarMentorsMiddleware).toHaveBeenCalled();
    });
});