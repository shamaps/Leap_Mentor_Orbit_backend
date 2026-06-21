const bcrypt = require("bcryptjs");
const AppError = require("../utils/appError");
const { toUserDTO } = require("../utils/mappers/user.mapper");

const createLoginService = (repo, { logger }) => {
const login = async (email, password) => {
    if (!email || !password)
        throw new AppError(400, "email and password are required");

    const normalizedEmail = String(email).toLowerCase().trim();

    const user = await repo.findUserByEmail(normalizedEmail);

    if (!user?.password) {
        // Someone tried a non-existent email
        logger.warn("Login attempt with unregistered email", { email: normalizedEmail });
        throw new AppError(401, "Invalid credentials");
    }

    if (user.isDeleted) {
        // Blocked account access attempt
        logger.warn("Blocked account login attempt", {
            userId: user._id,
            email: normalizedEmail,
        });
        throw new AppError(403, "Your account has been blocked. Please contact support.");
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
        //  Wrong password
        logger.warn("Invalid password attempt", {
            userId: user._id,
            email: normalizedEmail,
        });
        throw new AppError(401, "Invalid credentials");
    }

    if (!user.isEmailVerified) {
        // Unverified email login attempt
        logger.warn("Login attempt before email verification", {
            userId: user._id,
            email: normalizedEmail,
        });
        throw new AppError(403, "Please verify your email before logging in.", {
            isEmailVerified: false,
            email: user.email,
        });
    }

    return { user: toUserDTO(user) };
};

    return { login };
};
module.exports = createLoginService;