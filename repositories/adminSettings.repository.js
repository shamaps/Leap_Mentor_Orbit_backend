// repositories/adminSettings.repository.js
const AdminUser = require("../models/AdminUser");
const User = require("../models/User");
const ConnectRequest = require("../models/ConnectRequest");

// ─── Overview ────────────────────────────────────────────────

const countTotalUsers = () => User.countDocuments();

const countActiveSessions = () =>
    ConnectRequest.countDocuments({ status: "ongoing" });

// ─── Admin document ──────────────────────────────────────────

const findAdminDocumentById = (adminId) => AdminUser.findById(adminId);

const findAdminCommissionById = (adminId) =>
    AdminUser.findById(adminId).select("commissionRate").lean();

// ─── Admin mutations ─────────────────────────────────────────

const findAdminByEmail = (normalizedEmail) =>
    AdminUser.findOne({ email: normalizedEmail });

const createAdmin = (data) => AdminUser.create(data);

const updateCommissionRate = (adminId, rate) =>
    AdminUser.findByIdAndUpdate(adminId, { commissionRate: rate });

module.exports = {
    countTotalUsers,
    countActiveSessions,
    findAdminDocumentById,
    findAdminCommissionById,
    findAdminByEmail,
    createAdmin,
    updateCommissionRate,
};