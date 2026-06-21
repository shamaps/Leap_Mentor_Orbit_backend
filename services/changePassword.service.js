// services/changePassword.service.js
const bcrypt = require("bcryptjs");
const AppError = require("../utils/appError");
const createChangePasswordService = (changePasswordRepo, { logger }) => {
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