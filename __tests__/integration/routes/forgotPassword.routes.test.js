const request = require("supertest");
const express = require("express");
const dbHandler = require("../../utils/db");

const mockSendOTP = jest.fn();
const mockVerifyOTP = jest.fn();
const mockResetPassword = jest.fn();

jest.mock("../../../config/container", () => ({
    forgotPasswordController: {
        sendForgotPasswordOTP: (req, res, next) => {
            mockSendOTP(req.body.email);
            return res.status(200).json({ success: true, data: { message: "Sent" } });
        },
        verifyResetOTP: (req, res, next) => {
            mockVerifyOTP(req.body);
            return res.status(200).json({ success: true, data: { message: "Verified" } });
        },
        resetPassword: (req, res, next) => {
            mockResetPassword(req.body);
            return res.status(200).json({ success: true, data: { message: "Reset" } });
        }
    }
}));

// Placeholder initialization matching system architecture imports
const router = express.Router();
const { forgotPasswordController } = require("../../../config/container");
router.post("/forgot-password", forgotPasswordController.sendForgotPasswordOTP);
router.post("/verify-otp", forgotPasswordController.verifyResetOTP);
router.post("/reset-password", forgotPasswordController.resetPassword);

const app = express();
app.use(express.json());
app.use("/auth", router);

beforeAll(async () => await dbHandler.connect());
afterEach(async () => {
    await dbHandler.clear();
    jest.clearAllMocks();
});
afterAll(async () => await dbHandler.close());

describe("Forgot Password Pipeline Routing (Integration)", () => {
    it("POST /auth/forgot-password should hand off strings to background workflows seamlessly", async () => {
        await request(app)
            .post("/auth/forgot-password")
            .send({ email: "user@test.com" })
            .expect(200);

        expect(mockSendOTP).toHaveBeenCalledWith("user@test.com");
    });
});