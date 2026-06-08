const { issueTokens, sanitizeUser, validateRoles } = require("../utils/auth.utils");
const repo = require("../repositories/socialAuth.repository");

const { logger } = require("@sentry/node");
const ALLOWED_PROVIDERS = ["linkedin", "apple"];

const socialAuth = async ({ provider, providerId, email, name, roles, termsAccepted, res }) => {
    if (!ALLOWED_PROVIDERS.includes(provider)) {
        return { status: 400, body: { message: "Invalid provider" } };
    }

    if (!providerId) {
        return { status: 400, body: { message: "providerId is required" } };
    }

    // ── 1. Existing OAuth account → login directly ──
    const existingOAuth = await repo.findOAuthAccount(provider, providerId);
    if (existingOAuth?.user) {
        const accessToken = await issueTokens(res, existingOAuth.user._id);
        return {
            status: 200,
            body: { message: "Social login successful", accessToken, user: sanitizeUser(existingOAuth.user) },
        };
    }

    // ── 2. New OAuth account → need email to create/link ──
    if (!email) {
        return { status: 400, body: { message: "email is required to create/link account" } };
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    let user = await repo.findUserByEmail(normalizedEmail);

    if (!user) {
        if (termsAccepted !== true) {
            return { status: 400, body: { message: "You must accept terms to continue" } };
        }

        const incomingRoles = Array.isArray(roles) && roles.length ? roles : ["mentee"];
        const { valid, message, uniqueRoles } = validateRoles(incomingRoles);
        if (!valid) return { status: 400, body: { message } };

        user = await repo.createUser({
            name: name ? String(name).trim() : "User",
            email: normalizedEmail,
            password: undefined,
            roles: uniqueRoles,
            isEmailVerified: true,
            termsAccepted: true,
            termsAcceptedAt: new Date(),
        });
    }

    await repo.createOAuthAccount(user._id, provider, providerId);

    const accessToken = await issueTokens(res, user._id);
    return {
        status: 200,
        body: { message: "Social login successful", accessToken, user: sanitizeUser(user) },
    };
};

module.exports = { socialAuth };