// services/changePassword.service.js
const bcrypt = require("bcryptjs");
const AppError = require("../utils/appError");

/**
 * @typedef {Object} ChangePasswordRepository
 * @property {(userId: string) => Promise<Object|null>} findUserWithPassword - Fetches a user document including the hidden password field.
 */

/**
 * @typedef {Object} Logger
 * @property {(message: string) => void} info
 * @property {(message: string, error: any) => void} error
 */

/**
 * Factory function to create the Change Password Service layer.
 * * @param {ChangePasswordRepository} changePasswordRepo - The repository instance for database interaction.
 * @param {{ logger: Logger }} dependencies - Application logging tools.
 * @returns {Object} An object containing the password updates execution method.
 */
const createChangePasswordService = (changePasswordRepo, { logger }) => {

    /**
     * Validates credentials, verifies the current password, and persists a newly encrypted password.
     * * @async
     * @function changePassword
     * @param {string} userId - Unique identifier of the user changing their password.
     * @param {string} currentPassword - Raw input of the user's current password.
     * @param {string} newPassword - Raw input of the target new password.
     * @throws {AppError} 400 - If fields are missing or the new password is shorter than 6 characters.
     * @throws {AppError} 404 - If no user matches the provided ID.
     * @throws {AppError} 401 - If the input current password fails verification against database record.
     * @returns {Promise<{ message: string }>} Success message confirmation payload.
     */
    const changePassword = async (userId, currentPassword, newPassword) => {
        if (!currentPassword || !newPassword) {
            throw new AppError(400, "All fields are required");
        }
        if (newPassword.length < 6) {
            throw new AppError(400, "New password must be at least 6 characters");
        }

        const user = await changePasswordRepo.findUserWithPassword(userId);
        if (!user) {
            throw new AppError(404, "User not found");
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            throw new AppError(401, "Current password is incorrect");
        }

        const hashed = await bcrypt.hash(newPassword, 12);
        user.password = hashed;
        user.passwordChangedAt = new Date();
        await user.save();

        return { message: "Password changed successfully" };
    };

    return { changePassword };
};

module.exports = createChangePasswordService;