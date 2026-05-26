const SupportMessage = require("../models/SupportMessage");
const Notification = require("../models/Notification");
const User = require("../models/User");

const createSupportMessage = (data) => SupportMessage.create(data);

const findAllMessages = () => SupportMessage.find().sort({ createdAt: -1 });

const resolveMessageById = (id) =>
    SupportMessage.findByIdAndUpdate(id, { status: "resolved" }, { new: true });

const findUserByEmail = (email) => User.findOne({ email });

const createNotification = (data) => Notification.create(data);

module.exports = {
    createSupportMessage,
    findAllMessages,
    resolveMessageById,
    findUserByEmail,
    createNotification,
};