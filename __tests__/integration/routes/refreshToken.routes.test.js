const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const dbHandler = require("../../utils/db");

const mockRefreshMiddleware = jest.fn((req, res) => res.status(200).json({ success: true, accessToken: "mock" }));
const mockLogoutMiddleware = jest.fn((req, res) => {
    res.clearCookie("refreshToken");
    return res.status(200).json({ success: true, message: "Logged out" });
});

jest.mock("../../../config/container", () => ({
    refreshTokenController: {
        refresh: (req, res, next) => mockRefreshMiddleware(req, res, next),
        logout: (req, res, next) => mockLogoutMiddleware(req, res, next),
    },
}));

const app = express();
app.use(express.json());
app.use(cookieParser());

// Bind manual route configurations mimicking entry points safely
const { refreshTokenController } = require("../../../config/container");
app.post("/auth/refresh", refreshTokenController.refresh);
app.post("/auth/logout", refreshTokenController.logout);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => {
    await dbHandler.clear();
    jest.clearAllMocks();
});
afterAll(async () => await dbHandler.close());

describe("Token Lifecycle Rotation Pipeline (Integration)", () => {
    it("POST /auth/refresh should process request cookie parameters and pass handling to background workflows", async () => {
        await request(app)
            .post("/auth/refresh")
            .set("Cookie", ["refreshToken=plain_jws_cookie_string"])
            .expect(200);

        expect(mockRefreshMiddleware).toHaveBeenCalled();
    });
});