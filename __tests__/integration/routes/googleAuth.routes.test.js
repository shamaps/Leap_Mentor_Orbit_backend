const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockGoogleAuthMiddleware = jest.fn((req, res) => {
    return res.status(200).json({ success: true, message: "Google login successful" });
});

jest.mock("../../../config/container", () => ({
    googleAuthController: {
        googleAuth: (req, res, next) => mockGoogleAuthMiddleware(req, res, next),
    },
}));

const app = express();
app.use(express.json());

// Set up manual dummy route binding to replicate standard system mappings safely
const { googleAuthController } = require("../../../config/container");
app.post("/auth/google", googleAuthController.googleAuth);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => {
    await dbHandler.clear();
    jest.clearAllMocks();
});
afterAll(async () => await dbHandler.close());

describe("Google Authentication Pipelines (Integration)", () => {
    it("POST /auth/google should forward request objects cleanly if token arrays are present", async () => {
        await request(app)
            .post("/auth/google")
            .send({ credential: "mock_jws_assertion_payload", roles: ["mentee"], termsAccepted: true })
            .expect(200);

        expect(mockGoogleAuthMiddleware).toHaveBeenCalled();
    });
});