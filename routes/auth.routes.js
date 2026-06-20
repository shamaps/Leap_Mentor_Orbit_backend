// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const crypto = require("node:crypto");
const { handleError } = require("../utils/appError");
const RefreshToken = require("../models/RefreshToken");
const {
    signToken,
    setRefreshCookie,
    getRefreshMs,         
} = require("../utils/auth.utils");
const User = require("../models/User");
const { toUserDTO } = require("../utils/mappers/user.mapper");
const {
    loginLimiter,
    registerLimiter,
    oauthLimiter,
    forgotPasswordLimiter,
    otpLimiter,
} = require("../middleware/rateLimiter");
const {
    registerController,
    loginController,
    googleAuthController,
    clerkSSOController,
    changePasswordController,
    forgotPasswordController,
} = require("../config/container");

const { register } = registerController;
const { login } = loginController;
const { googleAuth } = googleAuthController;
const { clerkSSO } = clerkSSOController;
const { changePassword } = changePasswordController;
const { sendForgotPasswordOTP, verifyResetOTP, resetPassword } = forgotPasswordController;
const { authenticate } = require("../middleware/authenticate");

// Existing routes
router.post("/register",registerLimiter, register);
router.post("/login", loginLimiter,login);
router.post("/google", oauthLimiter, googleAuth);
router.post("/clerk-sso", oauthLimiter, clerkSSO);
router.patch("/password", authenticate, changePassword)

// ── Silent refresh ────────────────────────────────────────────
router.post("/refresh", async (req, res) => {
    try {
        const raw = req.cookies?.refreshToken;
        if (!raw) return res.status(401).json({ message: "No refresh token" });

        const hashed = crypto.createHash("sha256").update(raw).digest("hex");
        const stored = await RefreshToken.findOne({ tokenHash: hashed }).populate("user");

        if (!stored || stored.expiresAt < new Date()) {
            return res.status(401).json({ message: "Refresh token expired or invalid" });
        }

        // Rotation: delete old token, issue new pair
        await RefreshToken.deleteOne({ _id: stored._id });

        const newRefreshRaw = crypto.randomBytes(40).toString("hex");
        const newRefreshHash = crypto.createHash("sha256").update(newRefreshRaw).digest("hex");

        await RefreshToken.create({
            user: stored.user._id,
            tokenHash: newRefreshHash,
            expiresAt: new Date(Date.now() + getRefreshMs()),  // ✅ uses env, not hardcoded
        });

        const accessToken = signToken(stored.user._id);
        setRefreshCookie(res, newRefreshRaw);

        return res.json({
            accessToken,
            user: toUserDTO(stored.user),
        });
    } catch (err) {
        return handleError(res, err, "auth.refresh");
    }
});

// ── Logout ────────────────────────────────────────────────────
router.post("/logout", async (req, res) => {
    try {
        const raw = req.cookies?.refreshToken;
        if (raw) {
            const hashed = crypto.createHash("sha256").update(raw).digest("hex");
            await RefreshToken.deleteOne({ tokenHash: hashed });
        }
        res.clearCookie("refreshToken", { path: "/" });  // only clear refreshToken cookie
        return res.json({ message: "Logged out successfully" });
    } catch (err) {
        return handleError(res, err, "auth.logout");
    }
});

router.post("/forgot-password", forgotPasswordLimiter, sendForgotPasswordOTP);
router.post("/verify-reset-otp", otpLimiter, verifyResetOTP);
router.post("/reset-password", forgotPasswordLimiter, resetPassword);

module.exports = router;