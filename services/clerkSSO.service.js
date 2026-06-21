// backend/services/clerkSSO.service.js
const jwt = require("jsonwebtoken");
const AppError = require("../utils/appError");
const { withRetry } = require("../utils/withRetry");
const { clerkClient,  validateRoles, mergeRoles } = require("../utils/auth.utils");
const { provisionWallet } = require("../utils/wallet");
const { toUserDTO } = require("../utils/mappers/user.mapper");
const createClerkSSOService = (repo, { logger }) => {
// Pure helpers

const extractClerkMeta = (clerkUser) => {
    const email = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim();
    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
    const externalAccount = clerkUser.externalAccounts?.[0];
    const provider = externalAccount?.provider?.replace("oauth_", "").replace("_oidc", "");
    const providerId = externalAccount?.providerUserId;

    return { email, name, provider, providerId };
};


// Step helpers — extracted to reduce cognitive complexity

/**
 * Decodes the Clerk token and fetches the full user from Clerk API.
 * Extracted so the main function doesn't nest a try/catch inside its own try/catch.
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
 * Validates terms + roles, creates user + wallet.
 * Extracted to eliminate deep nesting that drove cognitive complexity > 15.
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
 * Links an OAuthAccount record if one doesn't already exist.
 * FIX: flipped negated condition `if (!existingOAuth)` → early-return on positive case.
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


// Main service function
// Cognitive complexity reduced from 31 → well under 15 by
// extracting resolveClerkUser / createNewUser / mergeRolesIfNeeded / linkOAuthAccount


const clerkSSO = async ({ clerkToken, roles, termsAccepted }) => {
    // 1) Validate token + fetch Clerk user
    const clerkUser = await resolveClerkUser(clerkToken);
    const { email, name, provider, providerId } = extractClerkMeta(clerkUser);

    logger.info("Clerk SSO identity resolved", { provider, name });

    if (!email) throw new AppError(400, "No email returned from provider");

    // 2) Find or create user
    // FIX: flipped negated condition `if (!user)` → positive branch first
    let user = await repo.findUserByEmail(email);
    let isNewUser = false;

    logger.debug("User found in DB", { found: !!user });
    if (user) {
        logger.info("Existing Clerk user found, skipping wallet", { roles: user.roles });
        await mergeRoles(user, roles, repo.saveUser);
    } else {
        user = await createNewUser({ name, email, roles, termsAccepted });
        isNewUser = true;
    }

    // 3) Link OAuth account
    await linkOAuthAccount(user._id, provider, providerId);

    // 4) Issue JWT
    return { user: toUserDTO(user), isNewUser };
};

    return { clerkSSO };
};
module.exports = createClerkSSOService;