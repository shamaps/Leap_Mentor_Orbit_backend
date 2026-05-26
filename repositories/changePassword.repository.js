// repositories/changePassword.repository.js
const User = require("../models/User");

const findUserWithPassword = (userId) =>
    User.findById(userId).select("+password");

module.exports = { findUserWithPassword };