// backend/repositories/login.repository.js
const User = require("../models/User");

// ignoreIsDeleted bypasses the soft-delete middleware so blocked users are found
const findUserByEmail = (email) =>
    User.findOne({ email }).setOptions({ ignoreIsDeleted: true });

module.exports = { findUserByEmail };