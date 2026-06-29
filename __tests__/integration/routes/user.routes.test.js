const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGetMeMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, data: req.user }));

jest.mock("../../../config/container", () => ({
    userController: {
        getMe: (req, res, next) => mockGetMeMiddleware(req, res, next),
    },
}));

jest.mock("../../../middleware/authenticate", () => ({
    authenticate: jest.fn((req, res, next) => {
        req.user = { _id: "user_session_sandbox_token_id", name: "Authenticated User" };
        next();
    }),
}));

describe("User Account Profile Routing Interface (Integration)", () => {
    let app;

    beforeAll(async () => {
        await dbHandler.connect();
        app = express();
        app.use(express.json());

        const userRoutes = require("../../../routes/user.routes");
        app.use("/users", userRoutes);
    });

    afterEach(async () => {
        await dbHandler.clear();
        jest.clearAllMocks();
    });

    afterAll(async () => {
        await dbHandler.close();
    });

    it("GET /users/me should pass security filter intercepts and deliver current session details", async () => {
        const res = await request(app)
            .get("/users/me")
            .expect(200);

        expect(mockGetMeMiddleware).toHaveBeenCalled();
        expect(res.body.data._id).toBe("user_session_sandbox_token_id");
    });
});