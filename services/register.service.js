// services/register.service.js
const bcrypt = require("bcryptjs");
const registerRepo = require("../repositories/register.repository");
const { issueTokens, sanitizeUser, validateRoles } = require("../utils/auth.utils");

// ── Helper: create wallet + welcome transaction for a role ────
const provisionWallet = async (userId, role) => {
    const isMentee = role === "mentee";
    const wallet = await registerRepo.createWallet({
        user: userId,
        role,
        balance: isMentee ? 500 : 0,
        escrow: 0,
    });
    console.log(`Wallet created — role: ${role}`, wallet);

    if (isMentee) {
        await registerRepo.createTransaction({
            user: userId,
            type: "credit",
            amount: 500,
            description: "Welcome bonus — 500 points to get started",
            balanceAfter: 500,
        });
    }
};

const register = async (res, body) => {
    const { name, email, password, roles, termsAccepted } = body;

    if (!roles || roles.length !== 1) {
        const err = new Error("Exactly one role is required.");
        err.statusCode = 400;
        throw err;
    }
    if (!name || !email || !password) {
        const err = new Error("name, email, password are required");
        err.statusCode = 400;
        throw err;
    }
    if (!Array.isArray(roles) || roles.length === 0) {
        const err = new Error("roles must be an array with at least one role");
        err.statusCode = 400;
        throw err;
    }
    if (termsAccepted !== true) {
        const err = new Error("You must accept terms to continue");
        err.statusCode = 400;
        throw err;
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const { valid, message, uniqueRoles } = validateRoles(roles);
    if (!valid) {
        const err = new Error(message);
        err.statusCode = 400;
        throw err;
    }

    const existing = await registerRepo.findUserByEmail(normalizedEmail);

    if (existing) {
        const newRoles = [...new Set([...existing.roles, ...uniqueRoles])];
        const rolesChanged = newRoles.length !== existing.roles.length;

        if (rolesChanged) {
            existing.roles = newRoles;
            await registerRepo.saveUser(existing);

            const addedRoles = uniqueRoles.filter((r) => !existing.roles.includes(r));
            for (const role of addedRoles) {
                const existingWallet = await registerRepo.findWalletByUserAndRole(existing._id, role);
                if (!existingWallet) {
                    await provisionWallet(existing._id, role);
                }
            }
        }

        const err = new Error("This email is already registered. Please login instead.");
        err.statusCode = 400;
        throw err;
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await registerRepo.createUser({
        name: String(name).trim(),
        email: normalizedEmail,
        password: hashed,
        roles: uniqueRoles,
        isEmailVerified: false,
        termsAccepted: true,
        termsAcceptedAt: new Date(),
    });

    for (const role of uniqueRoles) {
        await provisionWallet(user._id, role);
    }

    // issueTokens sets the refresh-token cookie on res
    const accessToken = await issueTokens(res, user._id);

    return {
        message: "Registered successfully",
        accessToken,
        user: sanitizeUser(user),
        isNewUser: true,
    };
};

module.exports = { register };