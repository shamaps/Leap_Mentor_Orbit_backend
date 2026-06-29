// services/adminSettings.service.js
const crypto = require("node:crypto");
const cache = require("../utils/cache");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} AdminSettingsRepository
 * @property {() => Promise<number>} countTotalUsers
 * @property {() => Promise<number>} countActiveSessions
 * @property {(adminId: string) => Promise<Object|null>} findAdminDocumentById
 * @property {(adminId: string) => Promise<Object|null>} findAdminCommissionById
 * @property {(email: string) => Promise<Object|null>} findAdminByEmail
 * @property {(data: Object) => Promise<Object>} createAdmin
 * @property {(adminId: string, rate: number) => Promise<Object|null>} updateCommissionRate
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function to create the Admin Settings Service.
 * * @param {AdminSettingsRepository} adminSettingsRepo - The repository instance for admin operations.
 * @param {{ logger: Logger }} dependencies - Global dependencies like logger.
 * @returns {Object} An object containing the admin settings service methods.
 */
const createAdminSettingsService = (adminSettingsRepo, { logger }) => {

    /**
     * Retrieves system overview counts (total users and active sessions), using cache where possible.
     * * @async
     * @function getOverview
     * @returns {Promise<{ totalUsers: number, activeSessions: number }>} The dashboard overview metrics.
     */
    const getOverview = async () => {
        const key = cache.NS.PLATFORM_SETTINGS;
        const cached = await cache.get(key);
        if (cached) return cached;

        const [totalUsers, activeSessions] = await Promise.all([
            adminSettingsRepo.countTotalUsers(),
            adminSettingsRepo.countActiveSessions(),
        ]);
        const result = { totalUsers, activeSessions };
        await cache.set(key, result, cache.TTL.PLATFORM_SETTINGS);
        return result;
    };

    /**
     * Validates and updates an admin's password.
     * * @async
     * @function changePassword
     * @param {string} adminId - The unique ID of the performing admin.
     * @param {string} currentPassword - The current password to verify.
     * @param {string} newPassword - The new password to set.
     * @throws {AppError} 400 - If fields are missing, schema constraints fail, or current password doesn't match.
     * @throws {AppError} 404 - If the admin document is missing.
     * @returns {Promise<{ message: string }>} Success message response.
     */
    const changePassword = async (adminId, currentPassword, newPassword) => {
        if (!currentPassword || !newPassword) {
            throw new AppError(400, "All fields are required");
        }
        if (newPassword.length < 6) {
            throw new AppError(400, "New password must be at least 6 characters.");
        }
        if (currentPassword === newPassword) {
            throw new AppError(400, "New password must be different.");
        }

        const admin = await adminSettingsRepo.findAdminDocumentById(adminId);
        if (!admin) {
            throw new AppError(404, "Admin not found.");
        }

        const isMatch = await admin.comparePassword(currentPassword);
        if (!isMatch) {
            throw new AppError(400, "Current password is incorrect.");
        }

        admin.password = newPassword;
        await admin.save();

        return { message: "Password changed successfully." };
    };

    /**
     * Adds a new standard admin user and provisions a secure temporary password.
     * * @async
     * @function addAdmin
     * @param {string} name - The name of the new admin.
     * @param {string} email - The unique email address for the new admin.
     * @throws {AppError} 400 - If name or email are missing.
     * @throws {AppError} 409 - If an admin with the given email already exists.
     * @returns {Promise<{ message: string, tempPassword: string, admin: { _id: string, name: string, email: string } }>} The created admin details and raw temporary password.
     */
    const addAdmin = async (name, email) => {
        if (!name?.trim() || !email?.trim()) {
            throw new AppError(400, "Name and email are required.");
        }

        const normalizedEmail = email.toLowerCase().trim();

        const existing = await adminSettingsRepo.findAdminByEmail(normalizedEmail);
        if (existing) {
            throw new AppError(409, "An admin with this email already exists.");
        }

        const tempPassword = crypto.randomBytes(12).toString("base64url").slice(0, 12) + "A1!";

        const newAdmin = await adminSettingsRepo.createAdmin({
            name: name.trim(),
            email: normalizedEmail,
            password: tempPassword,
            isSuperAdmin: false,
            isActive: true,
        });

        return {
            message: `Admin account created for ${email}.`,
            tempPassword,
            admin: {
                _id: newAdmin._id,
                name: newAdmin.name,
                email: newAdmin.email,
            },
        };
    };

    /**
     * Gets an admin's customized commission rate, defaulting to 20% if unset.
     * * @async
     * @function getCommission
     * @param {string} adminId - The unique ID of the target admin.
     * @returns {Promise<{ commissionRate: number }>} Object containing the applicable rate percentage.
     */
    const getCommission = async (adminId) => {
        const key = `${cache.NS.COMMISSION}:${adminId}`;
        const cached = await cache.get(key);
        if (cached) return cached;

        const admin = await adminSettingsRepo.findAdminCommissionById(adminId);
        const result = { commissionRate: admin?.commissionRate ?? 20 };
        await cache.set(key, result, cache.TTL.COMMISSION);
        return result;
    };

    /**
     * Updates an admin's commission rate and invalidates their current commission cache.
     * * @async
     * @function updateCommission
     * @param {string} adminId - The unique ID of the admin being modified.
     * @param {number|string} commissionRate - The new percentage rate (0 to 100).
     * @throws {AppError} 400 - If commissionRate is invalid or out of bounds.
     * @returns {Promise<{ message: string, commissionRate: number }>} Success metadata payload.
     */
    const updateCommission = async (adminId, commissionRate) => {
        const rate = Number.parseFloat(commissionRate);
        if (Number.isNaN(rate) || rate < 0 || rate > 100) {
            throw new AppError(400, "Commission rate must be between 0 and 100.");
        }

        await adminSettingsRepo.updateCommissionRate(adminId, rate);
        await cache.del(`${cache.NS.COMMISSION}:${adminId}`);

        return { message: `Commission rate updated to ${rate}%`, commissionRate: rate };
    };

    return { getOverview, changePassword, addAdmin, getCommission, updateCommission };
};

module.exports = createAdminSettingsService;