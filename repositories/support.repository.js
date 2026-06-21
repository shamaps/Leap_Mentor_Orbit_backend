const SupportMessage = require("../models/SupportMessage");
const Notification = require("../models/Notification");
const User = require("../models/User");

const createSupportMessage = (data) => SupportMessage.create(data);

const findAllMessages = (skip = 0, limit = 50) =>
    SupportMessage.find()
        .select("email subject message role status createdAt")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

const countMessages = () => SupportMessage.countDocuments();

const resolveMessageById = (id) =>
    SupportMessage.findByIdAndUpdate(id, { status: "resolved" }, { new: true });

const findUserByEmail = (email) => User.findOne({ email });

const createNotification = (data) => Notification.create(data);

module.exports = {
    createSupportMessage,
    findAllMessages,
    countMessages,
    resolveMessageById,
    findUserByEmail,
    createNotification,
};