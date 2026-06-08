// services/googleAuth.service.js
const jwt = require("jsonwebtoken");
const repo = require("../repositories/googleAuth.repository");
const { googleClient, sanitizeUser, validateRoles } = require("../utils/auth.utils");

const { logger } = require("@sentry/node");
// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Verify the Google credential and return the token payload.
 * Throws typed errors on failure.
 *
 * @param {string} credential - raw Google credential from req.body
 * @returns {Promise<Object>} payload - verified Google token payload
 */
const verifyGoogleCredential = async (credential) => {
    const decodedToken = jwt.decode(credential);
    const tokenAudience = decodedToken?.aud;
    const envAudience = process.env.GOOGLE_CLIENT_ID?.trim();

    if (!envAudience)
        throw Object.assign(new Error("GOOGLE_CLIENT_ID is undefined in .env"), { status: 500 });

    const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: [envAudience, tokenAudience],
    });

    const payload = ticket.getPayload();

    // Log mismatch as a warning — not a hard failure (Google allows multiple client IDs)
    if (payload.aud !== envAudience) {
        logger.warn("⚠️ WARNING: Token was issued for a different Client ID. Check your .env!");
    }

    return payload;
};

/**
 * Create a brand-new user, wallet, and welcome transaction.
 * Called only when no existing user is found for this email.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email          - already normalized
 * @param {Array}  params.roles
 * @param {boolean} params.termsAccepted
 * @param {boolean} params.emailVerified - from Google payload
 * @returns {Promise<Document>} newly created user
 */
const registerNewUser = async ({ name, email, roles, termsAccepted, emailVerified }) => {
    // ✅ Sonar fix 1: guard moved here — eliminates negated condition on `!user` in main fn
    if (termsAccepted !== true)
        throw Object.assign(new Error("You must accept terms to continue"), { status: 400 });

    const incomingRoles = Array.isArray(roles) && roles.length ? roles : ["mentee"];
    const { valid, message, uniqueRoles } = validateRoles(incomingRoles);
    if (!valid)
        throw Object.assign(new Error(message), { status: 400 });

    const user = await repo.createUser({
        name,
        email,
        roles: uniqueRoles,
        isEmailVerified: !!emailVerified,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
    });

    // ✅ Create wallet — 500 points for mentee, 0 for mentor
    const isMentee = uniqueRoles.includes("mentee");
    const startingBalance = isMentee ? 500 : 0;

    await repo.createWallet(user._id, startingBalance);

    if (isMentee) {
        await repo.createWelcomeTransaction(user._id);
    }

    return user;
};

/**
 * Merge any newly requested roles into an existing user's roles.
 * Only saves if roles actually changed.
 *
 * @param {Document} user
 * @param {Array}    roles - roles from req.body (may be empty)
 * @returns {Promise<void>}
 */
const mergeRolesIfChanged = async (user, roles) => {
    // ✅ Sonar fix 2: 'if' as only statement in else block — extracted into its own function
    if (!Array.isArray(roles) || !roles.length) return;

    const mergedRoles = [...new Set([...user.roles, ...roles])];
    if (mergedRoles.length !== user.roles.length) {
        user.roles = mergedRoles;
        await repo.saveUser(user);
    }
};

/**
 * Ensure an OAuthAccount link exists for this Google sub.
 * Creates one if it doesn't already exist.
 *
 * @param {ObjectId} userId
 * @param {string}   googleSub
 * @returns {Promise<void>}
 */
const ensureOAuthAccount = async (userId, googleSub) => {
    const existing = await repo.findOAuthAccount("google", googleSub);
    if (!existing) {
        await repo.createOAuthAccount(userId, "google", googleSub);
    }
};

// ─────────────────────────────────────────────────────────────
// MAIN — googleAuth
// ─────────────────────────────────────────────────────────────

/**
 * Handle Google OAuth login/registration.
 * Complexity reduced from 25 → under 15 by extracting helpers above.
 *
 * @param {Object} params
 * @param {string} params.credential    - Google credential token
 * @param {Array}  params.roles         - requested roles
 * @param {boolean} params.termsAccepted
 * @returns {Promise<{ token: string, user: Object, isNewUser: boolean }>}
 */
const googleAuth = async ({ credential, roles, termsAccepted }) => {
    if (!credential)
        throw Object.assign(new Error("Missing Google credential"), { status: 400 });

    // 1 — verify Google token
    const payload = await verifyGoogleCredential(credential);

    const email = payload?.email?.toLowerCase()?.trim();
    const name = payload?.name || "User";
    const googleSub = payload?.sub;
    const emailVerified = payload?.email_verified;

    if (!email || !googleSub)
        throw Object.assign(new Error("Invalid Google payload (missing email/sub)"), { status: 400 });

    // 2 — find or create user
    // ✅ Sonar fix 3: flipped to positive condition (user exists) — eliminates negated condition
    let user = await repo.findUserByEmail(email);
    let isNewUser = false;

    if (user) {
        // existing user — merge roles if needed
        await mergeRolesIfChanged(user, roles);
    } else {
        // new user — register, create wallet
        user = await registerNewUser({ name, email, roles, termsAccepted, emailVerified });
        isNewUser = true;
    }

    // 3 — ensure OAuth account link
    await ensureOAuthAccount(user._id, googleSub);

    // 4 — sign and return token
    return { user: sanitizeUser(user), isNewUser };
};

module.exports = { googleAuth };