// services/register.service.js
const bcrypt = require("bcryptjs");
const { issueTokens, validateRoles } = require("../utils/auth.utils");
const { provisionWallet } = require("../utils/wallet");
const { toUserDTO } = require("../utils/mappers/user.mapper");
const AppError = require("../utils/appError");
const createRegisterService = (registerRepo, { logger }) => {
    const validateInput = (name, email, password, roles, termsAccepted) => {
        if (roles?.length !== 1)
            throw new AppError(400, "Exactly one role is required.");
        if (!name || !email || !password)
            throw new AppError(400, "name, email, password are required");
        if (!Array.isArray(roles) || roles.length === 0)
            throw new AppError(400, "roles must be an array with at least one role");
        if (termsAccepted !== true)
            throw new AppError(400, "You must accept terms to continue");
    };

    const handleExistingUser = async (existing, uniqueRoles) => {
        const addedRoles = uniqueRoles.filter((r) => !existing.roles.includes(r));
        const newRoles = [...new Set([...existing.roles, ...uniqueRoles])];
        const rolesChanged = newRoles.length !== existing.roles.length;

        if (rolesChanged) {
            existing.roles = newRoles;
            await registerRepo.saveUser(existing);

            for (const role of addedRoles) {
                const existingWallet = await registerRepo.findWalletByUserAndRole(existing._id, role);
                if (!existingWallet) {
                    await provisionWallet(existing._id, role);
                }
            }
        }
        throw new AppError(400, "This email is already registered. Please login instead.");
    };

    const register = async (res, body) => {
        const { name, email, password, roles, termsAccepted } = body;

        validateInput(name, email, password, roles, termsAccepted);

        const normalizedEmail = String(email).toLowerCase().trim();
        const { valid, message, uniqueRoles } = validateRoles(roles);
        if (!valid)
            throw new AppError(400, message);

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
            user: toUserDTO(user),
            isNewUser: true,
        };
    };

    return { register };
};
module.exports = createRegisterService;