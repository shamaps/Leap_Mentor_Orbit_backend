const User = require("../models/User");
const VerificationToken = require("../models/VerificationToken");

const findUserByEmail = (email) =>
    User.findOne({ email: String(email).toLowerCase().trim() });

const markEmailVerified = async (user) => {
    user.isEmailVerified = true;
    return user.save();
};

const deleteTokensByUser = (userId) =>
    VerificationToken.deleteMany({ user: userId });

const createVerificationToken = (data) => VerificationToken.create(data);

const findTokenByUser = (userId) =>
    VerificationToken.findOne({ user: userId });

module.exports = {
    findUserByEmail,
    markEmailVerified,
    deleteTokensByUser,
    createVerificationToken,
    findTokenByUser,
};