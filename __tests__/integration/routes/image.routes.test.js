const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetProfileImageMiddleware = jest.fn((req, res) => {
    return res.status(200).json({ success: true, data: { url: "https://cloudinary.com/img.jpg" } });
});

jest.mock("../../../config/container", () => ({
    imageController: {
        getProfileImage: (req, res, next) => mockGetProfileImageMiddleware(req, res, next),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_route_sandbox_id" };
        next();
    }),
}));

describe("Image Routing Channels (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const imageRoutes = require("../../../routes/image.routes");
        app.use("/images", imageRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /images/profile/:userId should secure endpoints and pass processing onward successfully", async () => {
        const response = await request(app)
            .get("/images/profile/user_abc_123?w=120&h=120")
            .expect(200);

        expect(response.body).toHaveProperty("success", true);
        expect(mockGetProfileImageMiddleware).toHaveBeenCalled();
    });
});