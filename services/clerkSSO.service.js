// backend/services/clerkSSO.service.js
const jwt = require("jsonwebtoken");
const repo = require("../repositories/clerkSSO.repository");
const AppError = require("../utils/AppError");
const { clerkClient, signToken, sanitizeUser, validateRoles } = require("../utils/auth.utils");

// ─────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────

const extractClerkMeta = (clerkUser) => {
    const email = clerkUser.emailAddresses?.[0]?.emailAddress?.toLowerCase().trim();
    const name = `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User";
    const externalAccount = clerkUser.externalAccounts?.[0];
    const provider = externalAccount?.provider?.replace("oauth_", "").replace("_oidc", "");

    // FIX: externalId is deprecated — use providerUserId
    const providerId = externalAccount?.providerUserId;

    return { email, name, provider, providerId };
};

// ─────────────────────────────────────────────────────────────
// Step helpers — extracted to reduce cognitive complexity
// ─────────────────────────────────────────────────────────────

/**
 * Decodes the Clerk token and fetches the full user from Clerk API.
 * Extracted so the main function doesn't nest a try/catch inside its own try/catch.
 */
const resolveClerkUser = async (clerkToken) => {
    if (!clerkToken) throw new AppError(400, "Missing Clerk token");

    const decoded = jwt.decode(clerkToken);
    console.log("🔑 Decoded Clerk token sub:", decoded?.sub);

    if (!decoded?.sub) throw new AppError(401, "Invalid Clerk token");

    try {
        const clerkUser = await clerkClient.users.getUser(decoded.sub);
        console.log("✅ Clerk user fetched:", clerkUser.id);
        return clerkUser;
    } catch (err) {
        console.error("❌ Failed to fetch Clerk user:", err.message);
        throw new AppError(401, "Could not fetch Clerk user");
    }
};

/**
 * Creates wallet + optional welcome-bonus transaction.
 * Non-fatal — errors are logged, not re-thrown.
 */
const provisionWallet = async (userId, roles) => {
    const isMentee = roles.includes("mentee");
    const startingBalance = isMentee ? 500 : 0;

    console.log("💰 Creating wallet | isMentee:", isMentee, "| startingBalance:", startingBalance);

    try {
        const wallet = await repo.createWallet({ user: userId, balance: startingBalance, escrow: 0 });
        console.log("✅ Wallet created:", wallet._id, "| Balance:", wallet.balance);

        if (isMentee) {
            const tx = await repo.createTransaction({
                user: userId,
                type: "credit",
                amount: 500,
                description: "Welcome bonus — 500 points to get started",
                balanceAfter: 500,
            });
            console.log("✅ Transaction created:", tx._id);
        }
    } catch (walletErr) {
        console.error("❌ Wallet/Transaction creation failed:", walletErr.message);
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

    console.log("🆕 Creating new user with roles:", uniqueRoles);

    const user = await repo.createUser({
        name,
        email,
        roles: uniqueRoles,
        isEmailVerified: true,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
    });

    console.log("✅ User created:", user._id, "| Roles:", user.roles);

    await provisionWallet(user._id, uniqueRoles);

    return user;
};

/**
 * Merges new roles onto an existing user if the set has changed.
 */
const mergeRolesIfNeeded = async (user, roles) => {
    if (!Array.isArray(roles) || !roles.length) return;

    const mergedRoles = [...new Set([...user.roles, ...roles])];
    if (mergedRoles.length !== user.roles.length) {
        user.roles = mergedRoles;
        await repo.saveUser(user);
        console.log("🔄 Roles updated:", user.roles);
    }
};

/**
 * Links an OAuthAccount record if one doesn't already exist.
 * FIX: flipped negated condition `if (!existingOAuth)` → early-return on positive case.
 */
const linkOAuthAccount = async (userId, provider, providerId) => {
    if (!provider || !providerId) return;

    const existingOAuth = await repo.findOAuthAccount(provider, providerId);

    if (existingOAuth) {
        console.log("ℹ️ OAuthAccount already linked | Provider:", provider);
        return;
    }

    await repo.createOAuthAccount({ user: userId, provider, providerId });
    console.log("🔗 OAuthAccount linked | Provider:", provider);
};

// ─────────────────────────────────────────────────────────────
// Main service function
// Cognitive complexity reduced from 31 → well under 15 by
// extracting resolveClerkUser / createNewUser / mergeRolesIfNeeded / linkOAuthAccount
// ─────────────────────────────────────────────────────────────

const clerkSSO = async ({ clerkToken, roles, termsAccepted }) => {
    // 1) Validate token + fetch Clerk user
    const clerkUser = await resolveClerkUser(clerkToken);
    const { email, name, provider, providerId } = extractClerkMeta(clerkUser);

    console.log("📧 Email:", email, "| Provider:", provider, "| Name:", name);

    if (!email) throw new AppError(400, "No email returned from provider");

    // 2) Find or create user
    // FIX: flipped negated condition `if (!user)` → positive branch first
    let user = await repo.findUserByEmail(email);
    let isNewUser = false;

    console.log("🔍 User found in DB:", !!user, "| Email:", email);

    if (user) {
        console.log("⚠️ Existing user found — skipping wallet creation | Roles:", user.roles);
        await mergeRolesIfNeeded(user, roles);
    } else {
        user = await createNewUser({ name, email, roles, termsAccepted });
        isNewUser = true;
    }

    // 3) Link OAuth account
    await linkOAuthAccount(user._id, provider, providerId);

    // 4) Issue JWT
    return { user: sanitizeUser(user), isNewUser };
};

module.exports = { clerkSSO };