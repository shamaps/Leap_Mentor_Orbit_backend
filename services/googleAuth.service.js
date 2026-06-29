// services/googleAuth.service.js
const jwt = require("jsonwebtoken");
const { googleClient, validateRoles, mergeRoles } = require("../utils/auth.utils");
const { provisionWallet } = require("../utils/wallet")
const AppError = require("../utils/appError");
const { withTimeout } = require("../utils/withTimeout");
const { toUserDTO } = require("../utils/mappers/user.mapper");
const config = require("../config/env");

/**
 * @typedef {Object} GoogleAuthRepository
 * @property {(email: string) => Promise<Object|null>} findUserByEmail - Resolves a user record by their normalized email address.
 * @property {(data: Object) => Promise<Object>} createUser - Inserts a new user document into the database.
 * @property {(user: Object) => Promise<Object>} saveUser - Persists updates or role changes on an existing user document.
 * @property {(provider: string, providerId: string) => Promise<Object|null>} findOAuthAccount - Searches for an existing third-party federation record.
 * @property {(userId: any, provider: string, providerId: string) => Promise<Object>} createOAuthAccount - Records a new federation link for a user.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string) => void} warn
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function creating the Google OAuth Authentication Service instance.
 * * @param {GoogleAuthRepository} repo - Data layer persistence abstraction interface.
 * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Configured object map containing the Google authentication service method.
 */
const createGoogleAuthService = (repo, { logger }) => {
    /**
     * Decode, safely verify with timeout boundaries, and extract the Google ID token payload.
     * Throws typed errors on configuration absence or verification timeouts.
     *
     * @private
     * @async
     * @function verifyGoogleCredential
     * @param {string} credential - Raw Google credential token string from inbound request.
     * @throws {AppError} 500 - If GOOGLE_CLIENT_ID is undefined inside environment configurations.
     * @returns {Promise<Object>} The verified Google token payload containing claim profiles.
     */
    const verifyGoogleCredential = async (credential) => {
        const decodedToken = jwt.decode(credential);
        const tokenAudience = decodedToken?.aud;
        const envAudience = config.googleClientId?.trim();

        if (!envAudience)
            throw new AppError(500, "GOOGLE_CLIENT_ID is undefined in .env");

        const ticket = await withTimeout(googleClient.verifyIdToken({
            idToken: credential,
            audience: [envAudience, tokenAudience]
        }), 8000, "Google token verification");

        const payload = ticket.getPayload();

        if (payload.aud !== envAudience) {
            logger.warn("⚠️ WARNING: Token was issued for a different Client ID. Check your .env!");
        }

        return payload;
    };

    /**
     * Provisions a brand-new user record and executes initial resource allocation.
     * Called only when no existing user is found matching the verified email.
     *
     * @private
     * @async
     * @function registerNewUser
     * @param {Object} params - Initial user parameters package context.
     * @param {string} params.name - User human name string derived from identity claims.
     * @param {string} params.email - Lowercased, stripped, unique user target email address.
     * @param {string[]} params.roles - Requested system access level capabilities.
     * @param {boolean} params.termsAccepted - Compliance flag state for policies acceptance.
     * @param {boolean} params.emailVerified - Verification state flag provided directly by Google assertions.
     * @throws {AppError} 400 - If terms are unaccepted or requested role shapes fail validation rules.
     * @returns {Promise<Object>} The newly created, saved platform internal User document model.
     */
    const registerNewUser = async ({ name, email, roles, termsAccepted, emailVerified }) => {
        if (termsAccepted !== true)
            throw new AppError(400, "You must accept terms to continue");

        const incomingRoles = Array.isArray(roles) && roles.length ? roles : ["mentee"];
        const { valid, message, uniqueRoles } = validateRoles(incomingRoles);
        if (!valid)
            throw new AppError(400, message);

        const user = await repo.createUser({
            name,
            email,
            roles: uniqueRoles,
            isEmailVerified: !!emailVerified,
            termsAccepted: true,
            termsAcceptedAt: new Date(),
        });

        await provisionWallet(user._id, uniqueRoles);
        return user;
    };

    /**
     * Verifies presence or generates structural provider linkages tracking federated accounts.
     *
     * @private
     * @async
     * @function ensureOAuthAccount
     * @param {any} userId - Target primary key tracking internal account user models.
     * @param {string} googleSub - Upstream provider identifier index pointer.
     * @returns {Promise<void>} Resolves upon confirmed presence or completed mapping record insertions.
     */
    const ensureOAuthAccount = async (userId, googleSub) => {
        const existing = await repo.findOAuthAccount("google", googleSub);
        if (!existing) {
            await repo.createOAuthAccount(userId, "google", googleSub);
        }
    };

    /**
     * Main handler orchestrating Google OAuth login, registration fallback, and role expansion paths.
     * Reduced complexity wrapper segregating operational orchestration.
     *
     * @async
     * @function googleAuth
     * @param {Object} params - Context parameter tracking structural state payload envelopes.
     * @param {string} params.credential - Unverified raw Google identification token assertion string.
     * @param {string[]} params.roles - Array map collection tracking requested capabilities.
     * @param {boolean} params.termsAccepted - Policy validation confirmation status tracker flag.
     * @throws {AppError} 400 - If credential parameters are absent or identity claims miss essential attributes.
     * @returns {Promise<{ user: Object, isNewUser: boolean }>} Sanitized user model mapping DTO and registration status flag.
     */
    const googleAuth = async ({ credential, roles, termsAccepted }) => {
        if (!credential)
            throw new AppError(400, "Missing Google credential");

        const payload = await verifyGoogleCredential(credential);

        const email = payload?.email?.toLowerCase()?.trim();
        const name = payload?.name || "User";
        const googleSub = payload?.sub;
        const emailVerified = payload?.email_verified;

        if (!email || !googleSub)
            throw new AppError(400, "Invalid Google payload (missing email/sub)");

        let user = await repo.findUserByEmail(email);
        let isNewUser = false;

        if (user) {
            await mergeRoles(user, roles, repo.saveUser);
        } else {
            user = await registerNewUser({ name, email, roles, termsAccepted, emailVerified });
            isNewUser = true;
        }

        await ensureOAuthAccount(user._id, googleSub);

        return { user: toUserDTO(user), isNewUser };
    };

    return { googleAuth };
};

module.exports = createGoogleAuthService;