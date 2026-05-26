// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const crypto = require("node:crypto");
const RefreshToken = require("../models/RefreshToken");
const {
    signToken,
    setRefreshCookie,
    sanitizeUser,
    getRefreshMs,          // ← imported now
} = require("../utils/auth.utils");
const User = require("../models/User");

const { register } = require("../controllers/register.controller");
const { login } = require("../controllers/login.controller");
const { googleAuth } = require("../controllers/googleAuth.controller");
const { socialAuth } = require("../controllers/socialAuth.controller");
const { clerkSSO } = require("../controllers/clerkSSO.controller");
const { changePassword } = require("../controllers/changePassword.controller");
const { authenticate } = require("../middleware/authenticate");

// Existing routes
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleAuth);
router.post("/social", socialAuth);
router.post("/clerk-sso", clerkSSO);
router.put("/change-password", authenticate, changePassword);

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
            user: sanitizeUser(stored.user),
        });
    } catch (err) {
        return res.status(500).json({ message: err.message });
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
        res.clearCookie("refreshToken", { path: "/" });  // ✅ only clear refreshToken cookie
        return res.json({ message: "Logged out successfully" });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// Forgot password routes
const {
    sendForgotPasswordOTP,
    verifyResetOTP,
    resetPassword,
} = require("../controllers/forgotPassword.controller");

router.post("/forgot-password", sendForgotPasswordOTP);
router.post("/verify-reset-otp", verifyResetOTP);
router.post("/reset-password", resetPassword);

module.exports = router;