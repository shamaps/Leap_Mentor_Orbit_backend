// backend/services/clerkSSO.service.js
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const { withRetry } = require("../utils/withRetry");
const { clerkClient, validateRoles, mergeRoles } = require("../utils/auth.utils");
const { provisionWallet } = require("../utils/wallet");
const { toUserDTO } = require("../utils/mappers/user.mapper");

/**
 * @typedef {Object} ClerkSSORepository
 * @property {(email: string) => Promise<Object|null>} findUserByEmail - Looks up a user record by email.
 * @property {(data: Object) => Promise<Object>} createUser - Inserts a fresh User document.
 * @property {(user: Object) => Promise<Object>} saveUser - Persists mutations on an existing User document.
 * @property {(provider: string, providerId: string) => Promise<Object|null>} findOAuthAccount - Looks up linked third-party account combinations.
 * @property {(data: Object) => Promise<Object>} createOAuthAccount - Records a new third-party profile linkage mapping.
 * @property {(userId: any, role: string) => Promise<Object|null>} findWalletByUserAndRole - Evaluates if a specialized ledger account exists.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string, meta?: Object) => void} info
 * @property {(message: string, meta?: Object) => void} debug
 * @property {(message: string, meta?: Object) => void} error
 */

/**
 * Factory function creating the Clerk Single Sign-On (SSO) Service instance.
 * * @param {ClerkSSORepository} repo - Data layer persistence abstraction instance.
 * @param {{ logger: Logger }} dependencies - Application core tracing infrastructure.
 * @returns {Object} Operational map holding SSO transaction methodology handler.
 */
const createClerkSSOService = (repo, { logger }) => {

    /**
     * Extracts identity information and third-party account telemetry from a raw Clerk payload.
     * * @function extractClerkMeta
     * @param {Object} clerkUser - Raw user schema block emitted by the Clerk integration library.
     * @returns {{ email: string|undefined, name: string, provider: string|undefined, providerId: string|undefined }} Cleaned semantic data identity object.
     */
    const extractClerkMeta = (clerkUser) => {
        const email = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim();
        const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
        const externalAccount = clerkUser.externalAccounts?.[0];
        const provider = externalAccount?.provider?.replace("oauth_", "").replace("_oidc", "");
        const providerId = externalAccount?.providerUserId;

        return { email, name, provider, providerId };
    };

    /**
     * Extracts token identities, validating sub claims prior to pinging external user registries via Clerk API.
     * * @async
     * @function resolveClerkUser
     * @param {string} clerkToken - Unverified raw JSON Web Token string emitted by frontends.
     * @throws {AppError} 400 - If token argument string parameters evaluate empty.
     * @throws {AppError} 401 - If token parsing lacks a subject indicator or retrieval pings fail completely.
     * @returns {Promise<Object>} Complete user management information context model output from upstream integration pools.
     */
    const resolveClerkUser = async (clerkToken) => {
        if (!clerkToken) throw new AppError(400, "Missing Clerk token");

        const decoded = jwt.decode(clerkToken);
        logger.info("Decoded Clerk token", { sub: decoded?.sub });

        if (!decoded?.sub) throw new AppError(401, "Invalid Clerk token");

        try {
            const clerkUser = await withRetry(
                () => clerkClient.users.getUser(decoded.sub),
                { retries: 2, label: "clerkSSO.getUser", logger }
            );
            logger.info("Clerk user fetched", { clerkUserId: clerkUser.id });
            return clerkUser;
        } catch (err) {
            logger.error("Failed to fetch Clerk user", { error: err.message, stack: err.stack });
            throw new AppError(401, "Could not fetch Clerk user");
        }
    };

    /**
     * Executes initial account construction workflow incorporating terms tracking and ledger initialization.
     * * @async
     * @function createNewUser
     * @param {Object} parameters - Core initial registration options container.
     * @param {string} parameters.name - Derived human identity string context.
     * @param {string} parameters.email - Validated, lowercased unique target user email address.
     * @param {string[]} [parameters.roles] - Initial system roles requested during onboarding.
     * @param {boolean} parameters.termsAccepted - Compliance verification status flag state.
     * @throws {AppError} 400 - If explicit terms criteria are unaccepted or role schemas fail validity checks.
     * @returns {Promise<Object>} Fully hydrated, persisted platform internal User document model instance.
     */
    const createNewUser = async ({ name, email, roles, termsAccepted }) => {
        if (termsAccepted !== true)
            throw new AppError(400, "You must accept terms to continue");

        const incomingRoles = Array.isArray(roles) && roles.length ? roles : ["mentee"];
        const { valid, message, uniqueRoles } = validateRoles(incomingRoles);
        if (!valid) throw new AppError(400, message);

        logger.info("Creating new Clerk user", { roles: uniqueRoles });

        const user = await repo.createUser({
            name,
            email,
            roles: uniqueRoles,
            isEmailVerified: true,
            termsAccepted: true,
            termsAcceptedAt: new Date(),
        });

        logger.info("Clerk user created", { userId: user._id.toString(), roles: user.roles });

        try {
            await provisionWallet(user._id, uniqueRoles);
        } catch (walletErr) {
            logger.error("Wallet provisioning failed during Clerk SSO", { error: walletErr.message, userId: user._id.toString() });
        }

        return user;
    };

    /**
     * Establishes external federation structural linkage references inside internal index sets.
     * * @async
     * @function linkOAuthAccount
     * @param {any} userId - Destination object identifier primary key tracking platform users.
     * @param {string} provider - Federation channel system string tag.
     * @param {string} providerId - Remote identification signature unique to upstream source provider.
     * @returns {Promise<void>} Processing resolves on skipped duplicates or completed mappings.
     */
    const linkOAuthAccount = async (userId, provider, providerId) => {
        if (!provider || !providerId) return;

        const existingOAuth = await repo.findOAuthAccount(provider, providerId);

        if (existingOAuth) {
            logger.info("OAuthAccount already linked", { provider });
            return;
        }

        await repo.createOAuthAccount({ user: userId, provider, providerId });
        logger.info("OAuthAccount linked", { provider });
    };

    /**
     * Main handler processing inbound Clerk assertions, matching email criteria, merging capabilities dynamically, and tracking registration states.
     * * @async
     * @function clerkSSO
     * @param {Object} input - Network input parameters payload package context.
     * @param {string} input.clerkToken - Base authorization exchange ticket string.
     * @param {string[]} [input.roles] - Incoming capability profiles array configurations.
     * @param {boolean} [input.termsAccepted] - Policy confirmation flag status tracker.
     * @throws {AppError} 400 - If resolved assertion payloads provide no usable destination email contexts.
     * @returns {Promise<{ user: Object, isNewUser: boolean }>} Sanitized profile DTO mapping combined with boolean flag tracking onboarding status.
     */
    const clerkSSO = async ({ clerkToken, roles, termsAccepted }) => {
        const clerkUser = await resolveClerkUser(clerkToken);
        const { email, name, provider, providerId } = extractClerkMeta(clerkUser);

        logger.info("Clerk SSO identity resolved", { provider, name });

        if (!email) throw new AppError(400, "No email returned from provider");

        let user = await repo.findUserByEmail(email);
        let isNewUser = false;

        logger.debug("User found in DB", { found: !!user });
        if (user) {
            const rolesBefore = new Set(user.roles);
            await mergeRoles(user, roles, repo.saveUser);
            const addedRoles = user.roles.filter((r) => !rolesBefore.has(r));

            for (const role of addedRoles) {
                const existingWallet = await repo.findWalletByUserAndRole(user._id, role);
                if (!existingWallet) {
                    try {
                        await provisionWallet(user._id, role);
                    } catch (walletErr) {
                        logger.error("Wallet provisioning failed during Clerk SSO role merge", { error: walletErr.message, userId: user._id.toString() });
                    }
                }
            }

            logger.info("Existing Clerk user found", { roles: user.roles, addedRoles });
        } else {
            user = await createNewUser({ name, email, roles, termsAccepted });
            isNewUser = true;
        }

        await linkOAuthAccount(user._id, provider, providerId);

        return { user: toUserDTO(user), isNewUser };
    };

    return { clerkSSO };
};

module.exports = createClerkSSOService;