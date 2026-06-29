// repositories/changePassword.repository.js
const User = require("../models/User");

/**
 * Resolves a User document by its primary key, explicitly selecting the usually hidden password field.
 * * @function findUserWithPassword
 * @param {string} userId - The unique user object identifier string.
 * @returns {Promise<Object|null>} Hydrated Mongoose document containing password field data, or null if not found.
 */
const findUserWithPassword = (userId) =>
    User.findById(userId).select("+password");

module.exports = { findUserWithPassword };