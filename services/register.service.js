// services/register.service.js
const bcrypt = require("bcryptjs");
const registerRepo = require("../repositories/register.repository");
const { issueTokens, sanitizeUser, validateRoles } = require("../utils/auth.utils");
const { provisionWallet } = require("../utils/wallet");
const logger = require("../utils/logger");

const validateInput = (name, email, password, roles, termsAccepted) => {
    if (roles?.length !== 1)
        throw Object.assign(new Error("Exactly one role is required."), { statusCode: 400 });
    if (!name || !email || !password)
        throw Object.assign(new Error("name, email, password are required"), { statusCode: 400 });
    if (!Array.isArray(roles) || roles.length === 0)
        throw Object.assign(new Error("roles must be an array with at least one role"), { statusCode: 400 });
    if (termsAccepted !== true)
        throw Object.assign(new Error("You must accept terms to continue"), { statusCode: 400 });
};

// ── Extracted helper: handles role-merge logic for existing users ─
const handleExistingUser = async (existing, uniqueRoles) => {
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

    throw Object.assign(
        new Error("This email is already registered. Please login instead"),
        { statusCode: 400 }
    );
};

const register = async (res, body) => {
    const { name, email, password, roles, termsAccepted } = body;

    validateInput(name, email, password, roles, termsAccepted);

    const normalizedEmail = String(email).toLowerCase().trim();
    const { valid, message, uniqueRoles } = validateRoles(roles);
    if (!valid)
        throw Object.assign(new Error(message), { statusCode: 400 });

    const existing = await registerRepo.findUserByEmail(normalizedEmail);
    if (existing) {
        await handleExistingUser(existing, uniqueRoles);
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

    const accessToken = await issueTokens(res, user._id);

    return {
        message: "Registered successfully",
        accessToken,
        user: sanitizeUser(user),
        isNewUser: true,
    };
};

module.exports = { register };