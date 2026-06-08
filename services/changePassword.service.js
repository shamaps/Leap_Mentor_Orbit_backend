// services/changePassword.service.js
const bcrypt = require("bcryptjs");
const changePasswordRepo = require("../repositories/changePassword.repository");

const { logger } = require("@sentry/node");
const changePassword = async (userId, currentPassword, newPassword) => {
    if (!currentPassword || !newPassword) {
        const err = new Error("All fields are required.");
        err.statusCode = 400;
        throw err;
    }
    if (newPassword.length < 6) {
        const err = new Error("New password must be at least 6 characters.");
        err.statusCode = 400;
        throw err;
    }

    const user = await changePasswordRepo.findUserWithPassword(userId);
    if (!user) {
        const err = new Error("User not found.");
        err.statusCode = 404;
        throw err;
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
        const err = new Error("Current password is incorrect.");
        err.statusCode = 401;
        throw err;
    }

    const hashed = await bcrypt.hash(newPassword, 12);
    user.password = hashed;
    user.passwordChangedAt = new Date();
    await user.save();

    return { message: "Password changed successfully." };
};

module.exports = { changePassword };