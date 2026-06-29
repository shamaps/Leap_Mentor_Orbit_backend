const AppError = require("../utils/appError");
const { toUserDTO } = require("../utils/mappers/user.mapper");

/**
 * @typedef {Object} LoginRepository
 * @property {(email: string) => Promise<Object|null>} findUserByEmail - Queries user data maps, ignoring soft deletion flags.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} info - Logs standard informational parameters.
 * @property {(message: string, meta?: Object) => void} warn - Captures authentication telemetry and security warning states.
 * @property {(message: string, meta?: Object) => void} error - Traces low-level database operations exceptions.
 */

/**
 * Creates the login service.
 *
 * @module services/login.service
 * @param {LoginRepository} repo - Repository exposing user data access methods.
 * @param {Object} dependencies - External dependencies.
 * @param {Logger} dependencies.logger - Logger instance used for security and audit logging.
 * @returns {{login: Function}} Login service methods.
 */
const createLoginService = (repo, { logger }) => {
    /**
     * Authenticates a user using their email and password.
     *
     * The service:
     * - Validates required credentials.
     * - Normalizes the email address.
     * - Verifies that the user exists.
     * - Blocks deleted accounts.
     * - Validates the password.
     * - Ensures the email has been verified.
     * - Returns a sanitized user DTO on success.
     *
     * @async
     * @param {string} email - User's email address.
     * @param {string} password - User's plaintext password.
     * @returns {Promise<{user: Object}>} Authenticated user information.
     * @throws {AppError} 400 - If email or password parameter elements are unassigned.
     * @throws {AppError} 401 - If identity claims don't match, password check triggers falsy, or fields are missing.
     * @throws {AppError} 403 - If account blocks are active or verification lifecycle flags are false.
     */
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

        const isMatch = await user.matchPassword(password);
        if (!isMatch) {
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