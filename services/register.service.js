// services/register.service.js
const bcrypt = require("bcryptjs");
const { issueTokens, validateRoles } = require("../utils/auth.utils");
const { provisionWallet } = require("../utils/wallet");
const { toUserDTO } = require("../utils/mappers/user.mapper");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} RegisterRepository
 * @property {(normalizedEmail: string) => Promise<Object|null>} findUserByEmail - Queries user data records matching a normalized email address.
 * @property {(user: Object) => Promise<Object>} saveUser - Persists mutations on an existing User document.
 * @property {(data: Object) => Promise<Object>} createUser - Inserts a fresh User document record into the system.
 * @property {(userId: any, role: string) => Promise<Object|null>} findWalletByUserAndRole - Evaluates if a specialized ledger account already exists.
 * @property {(data: Object) => Promise<Object>} createWallet - Allocates a fresh financial ledger wallet instance.
 * @property {(data: Object) => Promise<Object>} createTransaction - Logs individual balance velocity records.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info - Logs routine service path completions.
 * @property {(message: string, error: any) => void} error - Traces application exception blocks.
 */

/**
 * Factory function constructing the core registration processing service layer.
 * * @param {RegisterRepository} registerRepo - Data layer persistence abstraction interface.
 * @param {{ logger: Logger }} dependencies - Application core telemetry tracing tools.
 * @returns {Object} Configured service interface containing user onboarding methods.
 */
const createRegisterService = (registerRepo, { logger }) => {

    /**
     * Syntactically evaluates inbound fields to ensure explicit criteria limits are fulfilled.
     * * @private
     * @function validateInput
     * @param {string} name - Raw human identity literal.
     * @param {string} email - Raw contact electronic address destination.
     * @param {string} password - Raw plaintext credential entry string.
     * @param {string[]} roles - Array tracking requested access level scopes.
     * @param {boolean} termsAccepted - Compliance tracker confirming policy agreement states.
     * @throws {AppError} 400 - If parameters are empty, roles aren't an array containing exactly 1 value, or terms are unaccepted.
     */
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

    /**
     * Resolves collisions with existing emails, merging missing access roles or provisioning wallets before rejecting duplicate accounts.
     * * @private
     * @async
     * @function handleExistingUser
     * @param {Object} existing - Hydrated Mongoose document model representing the existing user record.
     * @param {string[]} uniqueRoles - Validated list containing requested onboarding capabilities.
     * @throws {AppError} 400 - Always throws a redirection credential duplicate warning string.
     */
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

    /**
     * Orchestrates core user onboarding, crypto-hashing input passwords, persisting profiles, initializing wallets, and returning token envelopes.
     * * @async
     * @function register
     * @param {import('express').Response} res - Outbound network pipeline wrapper context required by security layers.
     * @param {Object} body - Intake context data payload holding credentials criteria.
     * @param {string} body.name - The target user display name string parameter.
     * @param {string} body.email - Un-normalized target destination email route criteria.
     * @param {string} body.password - Clear text string candidate credentials password parameter.
     * @param {string[]} body.roles - Array containing requested functional accessibility profiles.
     * @param {boolean} body.termsAccepted - Explicit policy compliance acknowledgment flag state.
     * @throws {AppError} 400 - If structural input formats break bounds, role scopes fail schema valid checks, or the email is already stored.
     * @returns {Promise<{ message: string, accessToken: string, user: Object, isNewUser: boolean }>} Sanitized profile metadata response combined with access keys.
     */
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