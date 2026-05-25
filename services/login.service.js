// services/login.service.js
const bcrypt = require("bcryptjs");
const repo = require("../repositories/login.repository");
const AppError = require("../utils/AppError");
const { sanitizeUser } = require("../utils/auth.utils");  // ← REMOVE signToken

const login = async (email, password) => {
    if (!email || !password)
        throw new AppError(400, "email and password are required");

    const normalizedEmail = String(email).toLowerCase().trim();
    const user = await repo.findUserByEmail(normalizedEmail);

    if (!user?.password)
        throw new AppError(401, "Invalid credentials");

    if (user.isDeleted)
        throw new AppError(403, "Your account has been blocked. Please contact support.");

    const ok = await bcrypt.compare(password, user.password);
    if (!ok)
        throw new AppError(401, "Invalid credentials");

    if (!user.isEmailVerified)
        throw Object.assign(
            new AppError(403, "Please verify your email before logging in."),
            { isEmailVerified: false, email: user.email }
        );

    // ← REMOVED: const token = signToken(user._id);
    // Controller calls issueTokens() — service just returns the user
    return { user};
};

module.exports = { login };